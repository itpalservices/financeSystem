from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.quote import Quote, QuoteLineItem, QuoteStatus
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from app.models.customer import Customer, CustomerStatus
from app.models.email_log import EmailLog, EmailType
from app.schemas import QuoteCreate, QuoteResponse, QuoteUpdate, EmailRequest, InvoiceResponse, CancelRequest
from app.auth import get_current_user
from app.utils.pdf_generator import generate_quote_pdf
from app.utils.email_sender import send_quote_email
from app.services.audit import log_action
from app.services.validation import get_customer_snapshot

router = APIRouter()

def generate_quote_number(db: Session) -> str:
    """Generate year-based quote number: QUO-YYYY-NNNNNN"""
    current_year = datetime.now().year
    year_prefix = f"QUO-{current_year}-"
    
    last_quote = db.query(Quote).filter(
        Quote.quote_number.like(f"{year_prefix}%")
    ).order_by(Quote.id.desc()).first()
    
    if last_quote:
        try:
            last_number = int(last_quote.quote_number.split('-')[2])
            return f"{year_prefix}{last_number + 1:06d}"
        except (IndexError, ValueError):
            return f"{year_prefix}000001"
    return f"{year_prefix}000001"

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

@router.post("", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    quote_data: QuoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote_number = generate_quote_number(db)
    
    subtotal = 0.0
    for item in quote_data.line_items:
        item_total = item.quantity * item.unit_price
        if item.discount and item.discount > 0:
            item_total = item_total * (1 - item.discount / 100)
        subtotal += item_total
    
    overall_discount = quote_data.discount if quote_data.discount is not None else 0.0
    discount_amount = subtotal * (overall_discount / 100) if overall_discount > 0 else 0
    subtotal_after_discount = subtotal - discount_amount
    
    tax_rate = quote_data.tax if quote_data.tax is not None else 0.0
    tax_amount = subtotal_after_discount * (tax_rate / 100)
    total = subtotal_after_discount + tax_amount
    
    new_quote = Quote(
        quote_number=quote_number,
        user_id=current_user.id,
        client_name=quote_data.client_name,
        company_name=quote_data.company_name,
        client_email=quote_data.client_email,
        telephone1=quote_data.telephone1,
        telephone2=quote_data.telephone2,
        client_reg_no=quote_data.client_reg_no,
        client_tax_id=quote_data.client_tax_id,
        client_address=quote_data.client_address,
        valid_until=quote_data.valid_until,
        subtotal=subtotal,
        discount=overall_discount,
        tax=tax_rate,
        total=total,
        notes=quote_data.notes
    )
    db.add(new_quote)
    db.flush()
    
    for item in quote_data.line_items:
        item_discount = item.discount if item.discount else 0.0
        item_total = item.quantity * item.unit_price
        if item_discount > 0:
            item_total = item_total * (1 - item_discount / 100)
        line_item = QuoteLineItem(
            quote_id=new_quote.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item_discount,
            total=item_total
        )
        db.add(line_item)
    
    db.commit()
    db.refresh(new_quote)
    
    log_action(
        db,
        action="create",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=new_quote.id,
        entity_number=new_quote.quote_number,
        description=f"Created quote {new_quote.quote_number}"
    )
    
    return new_quote

@router.get("", response_model=List[QuoteResponse])
def get_quotes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        quotes = db.query(Quote).order_by(Quote.id.desc()).all()
    else:
        quotes = db.query(Quote).filter(Quote.user_id == current_user.id).order_by(Quote.id.desc()).all()
    return quotes

@router.get("/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    return quote

@router.put("/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: int,
    quote_data: QuoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if quote.status in [QuoteStatus.issued, QuoteStatus.invoiced, QuoteStatus.cancelled]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit {quote.status.value} quote. Cancel and re-create if changes are needed."
        )
    
    old_status = quote.status
    
    if quote_data.client_name is not None:
        quote.client_name = quote_data.client_name
    if quote_data.company_name is not None:
        quote.company_name = quote_data.company_name
    if quote_data.client_email is not None:
        quote.client_email = quote_data.client_email
    if quote_data.telephone1 is not None:
        quote.telephone1 = quote_data.telephone1
    if quote_data.telephone2 is not None:
        quote.telephone2 = quote_data.telephone2
    if quote_data.client_reg_no is not None:
        quote.client_reg_no = quote_data.client_reg_no
    if quote_data.client_tax_id is not None:
        quote.client_tax_id = quote_data.client_tax_id
    if quote_data.client_address is not None:
        quote.client_address = quote_data.client_address
    if quote_data.valid_until is not None:
        quote.valid_until = quote_data.valid_until
    if quote_data.status is not None:
        quote.status = quote_data.status
    if quote_data.notes is not None:
        quote.notes = quote_data.notes
    if quote_data.discount is not None:
        quote.discount = quote_data.discount
    if quote_data.tax is not None:
        quote.tax = quote_data.tax
    
    if old_status == QuoteStatus.draft and quote.status == QuoteStatus.issued:
        quote.issued_at = datetime.utcnow()
        quote.issued_by = current_user.id
        quote.customer_snapshot = {
            "client_name": quote.client_name,
            "company_name": quote.company_name,
            "client_email": quote.client_email,
            "telephone1": quote.telephone1,
            "telephone2": quote.telephone2,
            "client_address": quote.client_address,
            "client_reg_no": quote.client_reg_no,
            "client_tax_id": quote.client_tax_id,
            "snapshot_at": datetime.utcnow().isoformat()
        }
    
    quote.pdf_url = None
    
    if quote_data.line_items is not None:
        db.query(QuoteLineItem).filter(QuoteLineItem.quote_id == quote_id).delete()
        
        subtotal = 0.0
        for item in quote_data.line_items:
            item_total = item.quantity * item.unit_price
            item_discount = item.discount if item.discount else 0.0
            if item_discount > 0:
                item_total = item_total * (1 - item_discount / 100)
            subtotal += item_total
            
            line_item = QuoteLineItem(
                quote_id=quote.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=item_discount,
                total=item_total
            )
            db.add(line_item)
        
        quote.subtotal = subtotal
        
        overall_discount = quote.discount or 0.0
        discount_amount = subtotal * (overall_discount / 100) if overall_discount > 0 else 0
        subtotal_after_discount = subtotal - discount_amount
        
        tax_rate = quote.tax or 0.0
        tax_amount = subtotal_after_discount * (tax_rate / 100)
        quote.total = subtotal_after_discount + tax_amount
    
    quote.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(quote)
    
    log_action(
        db,
        action="issue" if old_status == QuoteStatus.draft and quote.status == QuoteStatus.issued else "update",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=quote.id,
        entity_number=quote.quote_number,
        description=f"{'Issued' if old_status == QuoteStatus.draft and quote.status == QuoteStatus.issued else 'Updated'} quote {quote.quote_number}"
    )
    
    return quote

@router.post("/{quote_id}/issue", response_model=QuoteResponse)
def issue_quote(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Issue a draft quote (makes it immutable)."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if quote.status != QuoteStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft quotes can be issued"
        )
    
    if quote.customer_id:
        quote.customer_snapshot = get_customer_snapshot(db, quote.customer_id)
        customer = db.query(Customer).filter(Customer.id == quote.customer_id).first()
        if customer and customer.status == CustomerStatus.potential:
            customer.status = CustomerStatus.active
    else:
        quote.customer_snapshot = {
            "client_name": quote.client_name,
            "company_name": quote.company_name,
            "client_email": quote.client_email,
            "telephone1": quote.telephone1,
            "telephone2": quote.telephone2,
            "client_address": quote.client_address,
            "client_reg_no": quote.client_reg_no,
            "client_tax_id": quote.client_tax_id,
            "snapshot_at": datetime.utcnow().isoformat()
        }
    
    quote.status = QuoteStatus.issued
    quote.issued_at = datetime.utcnow()
    quote.issued_by = current_user.id
    
    db.commit()
    db.refresh(quote)
    
    log_action(
        db,
        action="issue",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=quote.id,
        entity_number=quote.quote_number,
        description=f"Issued quote {quote.quote_number}"
    )
    
    return quote

@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if quote.status != QuoteStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft quotes can be deleted. Use cancel to cancel issued quotes."
        )
    
    quote_number = quote.quote_number
    db.delete(quote)
    db.commit()
    
    log_action(
        db,
        action="delete",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=quote_id,
        entity_number=quote_number,
        description=f"Deleted draft quote {quote_number}"
    )

@router.post("/{quote_id}/cancel", response_model=QuoteResponse)
def cancel_quote(
    quote_id: int,
    cancel_data: CancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if quote.status == QuoteStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Draft quotes should be deleted, not cancelled."
        )
    
    if quote.status == QuoteStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quote is already cancelled."
        )
    
    quote.status = QuoteStatus.cancelled
    quote.cancelled_at = datetime.utcnow()
    quote.cancelled_by = current_user.id
    quote.cancel_reason = cancel_data.reason
    
    # Generate and lock the cancelled PDF immediately
    pdf_url = generate_quote_pdf(quote, db)
    quote.pdf_url = pdf_url
    
    db.commit()
    db.refresh(quote)
    
    log_action(
        db,
        action="cancel",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=quote.id,
        entity_number=quote.quote_number,
        description=f"Cancelled quote {quote.quote_number}: {cancel_data.reason}"
    )
    
    return quote

@router.post("/{quote_id}/convert-to-invoice", response_model=InvoiceResponse)
def convert_to_invoice(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from app.models.customer import Customer
    
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if quote.status == QuoteStatus.invoiced:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quote already converted to invoice")
    
    invoice_number = generate_invoice_number(db)
    
    customer_snapshot_data = None
    if quote.customer_id:
        customer_snapshot_data = get_customer_snapshot(db, quote.customer_id)
    else:
        customer_snapshot_data = {
            "client_name": quote.client_name,
            "company_name": quote.company_name,
            "client_email": quote.client_email,
            "telephone1": quote.telephone1,
            "telephone2": quote.telephone2,
            "client_address": quote.client_address,
            "client_reg_no": quote.client_reg_no,
            "client_tax_id": quote.client_tax_id,
            "snapshot_at": datetime.utcnow().isoformat()
        }
    
    new_invoice = Invoice(
        invoice_number=invoice_number,
        user_id=quote.user_id,
        customer_id=quote.customer_id,
        client_name=quote.client_name,
        company_name=quote.company_name,
        client_email=quote.client_email,
        telephone1=quote.telephone1,
        telephone2=quote.telephone2,
        client_reg_no=quote.client_reg_no,
        client_tax_id=quote.client_tax_id,
        client_address=quote.client_address,
        due_date=quote.valid_until,
        subtotal=quote.subtotal,
        discount=quote.discount or 0.0,
        tax=quote.tax,
        total=quote.total,
        notes=quote.notes,
        status=InvoiceStatus.draft,
        customer_snapshot=customer_snapshot_data
    )
    db.add(new_invoice)
    db.flush()
    
    for item in quote.line_items:
        invoice_line_item = InvoiceLineItem(
            invoice_id=new_invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount=item.discount or 0.0,
            total=item.total
        )
        db.add(invoice_line_item)
    
    quote.status = QuoteStatus.invoiced
    quote.converted_to_invoice_id = new_invoice.id
    
    db.commit()
    db.refresh(new_invoice)
    
    log_action(
        db,
        action="convert",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=quote.id,
        entity_number=quote.quote_number,
        description=f"Converted quote {quote.quote_number} to invoice {new_invoice.invoice_number}"
    )
    
    log_action(
        db,
        action="create",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="invoice",
        entity_id=new_invoice.id,
        entity_number=new_invoice.invoice_number,
        description=f"Created invoice {new_invoice.invoice_number} from quote {quote.quote_number}"
    )
    
    return new_invoice

@router.post("/{quote_id}/generate-pdf")
def generate_pdf(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    # For cancelled quotes, always return existing PDF (preserve immutability)
    if quote.status == QuoteStatus.cancelled:
        if quote.pdf_url:
            return {"message": "PDF retrieved successfully", "pdf_url": quote.pdf_url}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cancelled quote PDF not available. Contact support."
            )
    
    pdf_url = generate_quote_pdf(quote, db)
    quote.pdf_url = pdf_url
    db.commit()
    
    return {"message": "PDF generated successfully", "pdf_url": pdf_url}

@router.post("/{quote_id}/send-email")
def send_email(
    quote_id: int,
    email_data: EmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if not quote.pdf_url:
        pdf_url = generate_quote_pdf(quote, db)
        quote.pdf_url = pdf_url
        db.commit()
    
    send_quote_email(quote, email_data.recipient_email, email_data.message or "")
    
    customer = None
    if quote.telephone1:
        customer = db.query(Customer).filter(Customer.telephone1 == quote.telephone1).first()
    
    email_log = EmailLog(
        email_type=EmailType.quote,
        document_id=quote.id,
        document_number=quote.quote_number,
        recipient_email=email_data.recipient_email,
        subject=email_data.subject,
        message=email_data.message or "",
        pdf_url=quote.pdf_url,
        user_id=current_user.id,
        customer_id=customer.id if customer else None,
        telephone1=quote.telephone1,
        client_name=quote.client_name,
        company_name=quote.company_name,
        total_amount=quote.total
    )
    db.add(email_log)
    db.commit()
    
    log_action(
        db,
        action="send_email",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="quote",
        entity_id=quote.id,
        entity_number=quote.quote_number,
        description=f"Sent quote {quote.quote_number} to {email_data.recipient_email}"
    )
    
    return {"message": "Email sent successfully"}
