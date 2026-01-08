from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from app.models.customer import Customer
from app.models.email_log import EmailLog, EmailType
from app.schemas import InvoiceCreate, InvoiceResponse, InvoiceUpdate, EmailRequest, CancelRequest
from app.auth import get_current_user
from app.utils.pdf_generator import generate_invoice_pdf
from app.utils.email_sender import send_invoice_email

router = APIRouter()

def generate_invoice_number(db: Session) -> str:
    """Generate year-based invoice number: INV-YYYY-NNNNNN"""
    current_year = datetime.now().year
    year_prefix = f"INV-{current_year}-"
    
    last_invoice = db.query(Invoice).filter(
        Invoice.invoice_number.like(f"{year_prefix}%")
    ).order_by(Invoice.id.desc()).first()
    
    if last_invoice:
        try:
            last_number = int(last_invoice.invoice_number.split('-')[2])
            return f"{year_prefix}{last_number + 1:06d}"
        except (IndexError, ValueError):
            return f"{year_prefix}000001"
    return f"{year_prefix}000001"

def sync_customer(db: Session, client_name: str, company_name: str, client_email: str, 
                 telephone1: str, telephone2: str, client_address: str, 
                 client_reg_no: str, client_tax_id: str):
    """
    Auto-create or update customer based on telephone1 ONLY.
    - If customer with telephone1 exists: update their details
    - If customer doesn't exist: create new customer
    Only called when invoice is marked as issued.
    """
    if not telephone1 or telephone1.strip() == "":
        return
    
    existing_customer = db.query(Customer).filter(
        Customer.telephone1 == telephone1
    ).first()
    
    if existing_customer:
        if client_name:
            existing_customer.name = client_name
        if company_name is not None:
            existing_customer.company_name = company_name
        if client_email is not None:
            existing_customer.email = client_email
        if telephone2 is not None:
            existing_customer.telephone2 = telephone2
        if client_address is not None:
            existing_customer.address = client_address
        if client_reg_no is not None:
            existing_customer.client_reg_no = client_reg_no
        if client_tax_id is not None:
            existing_customer.client_tax_id = client_tax_id
        existing_customer.updated_at = datetime.utcnow()
    else:
        email_exists = False
        if client_email:
            email_exists = db.query(Customer).filter(Customer.email == client_email).first() is not None
        
        new_customer = Customer(
            name=client_name,
            company_name=company_name,
            email=client_email if not email_exists else None,
            telephone1=telephone1,
            telephone2=telephone2,
            address=client_address,
            client_reg_no=client_reg_no,
            client_tax_id=client_tax_id
        )
        db.add(new_customer)

@router.post("", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    invoice_data: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not invoice_data.client_name and not invoice_data.company_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either Client Name or Company Name must be provided"
        )
    
    invoice_number = generate_invoice_number(db)
    
    # Calculate line item totals with discount if line items have discount
    line_item_totals = []
    for item in invoice_data.line_items:
        item_subtotal = item.quantity * item.unit_price
        if item.discount and item.discount > 0:
            # Apply line item discount
            discount_amount = item_subtotal * (item.discount / 100)
            item_total = item_subtotal - discount_amount
        else:
            item_total = item_subtotal
        line_item_totals.append(item_total)
    
    subtotal = sum(line_item_totals)
    
    # Calculate discount and tax
    discount_percentage = invoice_data.discount if invoice_data.discount is not None else 0.0
    if discount_percentage > 0:
        discount_amount = subtotal * (discount_percentage / 100)
        subtotal_after_discount = subtotal - discount_amount
    else:
        subtotal_after_discount = subtotal
    
    tax_percentage = invoice_data.tax if invoice_data.tax is not None else 0.0
    tax_amount = subtotal_after_discount * (tax_percentage / 100)
    total = subtotal_after_discount + tax_amount
    
    new_invoice = Invoice(
        invoice_number=invoice_number,
        user_id=current_user.id,
        client_name=invoice_data.client_name,
        company_name=invoice_data.company_name,
        client_email=invoice_data.client_email,
        telephone1=invoice_data.telephone1,
        telephone2=invoice_data.telephone2,
        client_address=invoice_data.client_address,
        client_reg_no=invoice_data.client_reg_no,
        client_tax_id=invoice_data.client_tax_id,
        due_date=invoice_data.due_date,
        subtotal=subtotal,
        discount=discount_percentage,
        tax=tax_percentage,
        total=total,
        notes=invoice_data.notes
    )
    db.add(new_invoice)
    db.flush()
    
    for i, item in enumerate(invoice_data.line_items):
        line_item = InvoiceLineItem(
            invoice_id=new_invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item.discount if item.discount is not None else 0.0,
            total=line_item_totals[i]
        )
        db.add(line_item)
    
    db.commit()
    db.refresh(new_invoice)
    return new_invoice

@router.get("", response_model=List[InvoiceResponse])
def get_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        invoices = db.query(Invoice).order_by(Invoice.id.desc()).all()
    else:
        invoices = db.query(Invoice).filter(Invoice.user_id == current_user.id).order_by(Invoice.id.desc()).all()
    return invoices

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    if current_user.role != "admin" and invoice.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    return invoice

@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: int,
    invoice_data: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    if current_user.role != "admin" and invoice.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if invoice.status in [InvoiceStatus.issued, InvoiceStatus.cancelled]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Cannot edit {invoice.status.value} invoice. Cancel and re-issue if changes are needed."
        )
    
    old_status = invoice.status
    
    if invoice_data.client_name is not None:
        invoice.client_name = invoice_data.client_name
    if invoice_data.company_name is not None:
        invoice.company_name = invoice_data.company_name
    if invoice_data.client_email is not None:
        invoice.client_email = invoice_data.client_email
    if invoice_data.telephone1 is not None:
        invoice.telephone1 = invoice_data.telephone1
    if invoice_data.telephone2 is not None:
        invoice.telephone2 = invoice_data.telephone2
    if invoice_data.client_address is not None:
        invoice.client_address = invoice_data.client_address
    if invoice_data.client_reg_no is not None:
        invoice.client_reg_no = invoice_data.client_reg_no
    if invoice_data.client_tax_id is not None:
        invoice.client_tax_id = invoice_data.client_tax_id
    if invoice_data.due_date is not None:
        invoice.due_date = invoice_data.due_date
    if invoice_data.status is not None:
        invoice.status = invoice_data.status
    if invoice_data.notes is not None:
        invoice.notes = invoice_data.notes
    
    if old_status == InvoiceStatus.draft and invoice.status == InvoiceStatus.issued:
        invoice.issued_at = datetime.utcnow()
        invoice.issued_by = current_user.id
        invoice.customer_snapshot = {
            "client_name": invoice.client_name,
            "company_name": invoice.company_name,
            "client_email": invoice.client_email,
            "telephone1": invoice.telephone1,
            "telephone2": invoice.telephone2,
            "client_address": invoice.client_address,
            "client_reg_no": invoice.client_reg_no,
            "client_tax_id": invoice.client_tax_id,
            "snapshot_at": datetime.utcnow().isoformat()
        }
        sync_customer(
            db,
            client_name=invoice.client_name,
            company_name=invoice.company_name,
            client_email=invoice.client_email,
            telephone1=invoice.telephone1,
            telephone2=invoice.telephone2,
            client_address=invoice.client_address,
            client_reg_no=invoice.client_reg_no,
            client_tax_id=invoice.client_tax_id
        )
    
    invoice.pdf_url = None
    
    if invoice_data.line_items is not None:
        db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice_id).delete()
        
        # Calculate line item totals with discount if line items have discount
        line_item_totals = []
        for item in invoice_data.line_items:
            item_subtotal = item.quantity * item.unit_price
            if item.discount and item.discount > 0:
                # Apply line item discount
                discount_amount = item_subtotal * (item.discount / 100)
                item_total = item_subtotal - discount_amount
            else:
                item_total = item_subtotal
            line_item_totals.append(item_total)
        
        for i, item in enumerate(invoice_data.line_items):
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=item.discount if item.discount is not None else 0.0,
                total=line_item_totals[i]
            )
            db.add(line_item)
        
        invoice.subtotal = sum(line_item_totals)
    
    # Handle discount update
    if "discount" in invoice_data.model_fields_set:
        invoice.discount = invoice_data.discount or 0.0
    
    # Handle tax update
    if "tax" in invoice_data.model_fields_set:
        invoice.tax = invoice_data.tax or 0.0
    
    # Recalculate total whenever line items, discount, or tax change
    if invoice_data.line_items is not None or "discount" in invoice_data.model_fields_set or "tax" in invoice_data.model_fields_set:
        db.flush()
        current_line_items = db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice_id).all()
        if current_line_items:
            invoice.subtotal = sum(item.total for item in current_line_items)
        
        # Apply overall discount if present
        if invoice.discount > 0:
            discount_amount = invoice.subtotal * (invoice.discount / 100)
            subtotal_after_discount = invoice.subtotal - discount_amount
        else:
            subtotal_after_discount = invoice.subtotal
        
        # Apply tax
        tax_amount = subtotal_after_discount * ((invoice.tax or 0.0) / 100)
        invoice.total = subtotal_after_discount + tax_amount
    
    invoice.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(invoice)
    return invoice

@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    if current_user.role != "admin" and invoice.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if invoice.status != InvoiceStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft invoices can be deleted. Use cancel to cancel issued invoices."
        )
    
    db.delete(invoice)
    db.commit()

@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    cancel_data: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    if current_user.role != "admin" and invoice.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if invoice.status == InvoiceStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft invoices should be deleted, not cancelled."
        )
    
    if invoice.status == InvoiceStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already cancelled."
        )
    
    invoice.status = InvoiceStatus.cancelled
    invoice.cancelled_at = datetime.utcnow()
    invoice.cancelled_by = current_user.id
    invoice.cancel_reason = cancel_data.reason
    
    # Generate and lock the cancelled PDF immediately
    pdf_url = generate_invoice_pdf(invoice, db)
    invoice.pdf_url = pdf_url
    
    db.commit()
    db.refresh(invoice)
    return invoice

@router.post("/{invoice_id}/generate-pdf")
def generate_pdf(
    invoice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    if current_user.role != "admin" and invoice.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # For cancelled invoices, always return existing PDF (preserve immutability)
    if invoice.status == InvoiceStatus.cancelled:
        if invoice.pdf_url:
            return {"message": "PDF retrieved successfully", "pdf_url": invoice.pdf_url}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancelled invoice PDF not available. Contact support."
            )
    
    pdf_url = generate_invoice_pdf(invoice, db)
    invoice.pdf_url = pdf_url
    db.commit()
    
    return {"message": "PDF generated successfully", "pdf_url": pdf_url}

@router.post("/{invoice_id}/send-email")
def send_email(
    invoice_id: int,
    email_data: EmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    
    if current_user.role != "admin" and invoice.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if not invoice.pdf_url:
        pdf_url = generate_invoice_pdf(invoice, db)
        invoice.pdf_url = pdf_url
        db.commit()
    
    send_invoice_email(invoice, email_data.recipient_email, email_data.message or "")
    
    customer = None
    if invoice.telephone1:
        customer = db.query(Customer).filter(Customer.telephone1 == invoice.telephone1).first()
    
    email_log = EmailLog(
        email_type=EmailType.invoice,
        document_id=invoice.id,
        document_number=invoice.invoice_number,
        recipient_email=email_data.recipient_email,
        subject=email_data.subject,
        message=email_data.message or "",
        pdf_url=invoice.pdf_url,
        user_id=current_user.id,
        customer_id=customer.id if customer else None,
        telephone1=invoice.telephone1,
        client_name=invoice.client_name,
        company_name=invoice.company_name,
        total_amount=invoice.total
    )
    db.add(email_log)
    db.commit()
    
    return {"message": "Email sent successfully"}
