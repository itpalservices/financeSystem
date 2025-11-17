from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.quote import Quote, QuoteLineItem, QuoteStatus
from app.models.invoice import Invoice, InvoiceLineItem
from app.schemas import QuoteCreate, QuoteResponse, QuoteUpdate, EmailRequest, InvoiceResponse
from app.auth import get_current_user
from app.utils.pdf_generator import generate_quote_pdf
from app.utils.email_sender import send_quote_email

router = APIRouter()

def generate_quote_number(db: Session) -> str:
    last_quote = db.query(Quote).order_by(Quote.id.desc()).first()
    if last_quote:
        last_number = int(last_quote.quote_number.split('-')[1])
        return f"QUO-{last_number + 1:05d}"
    return "QUO-00001"

def generate_invoice_number(db: Session) -> str:
    last_invoice = db.query(Invoice).order_by(Invoice.id.desc()).first()
    if last_invoice:
        last_number = int(last_invoice.invoice_number.split('-')[1])
        return f"INV-{last_number + 1:05d}"
    return "INV-00001"

@router.post("", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    quote_data: QuoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote_number = generate_quote_number(db)
    
    subtotal = sum(item.quantity * item.unit_price for item in quote_data.line_items)
    tax = quote_data.tax if quote_data.tax is not None else 0.0
    total = subtotal + tax
    
    new_quote = Quote(
        quote_number=quote_number,
        user_id=current_user.id,
        client_name=quote_data.client_name,
        client_email=quote_data.client_email,
        client_address=quote_data.client_address,
        valid_until=quote_data.valid_until,
        subtotal=subtotal,
        tax=tax,
        total=total,
        notes=quote_data.notes
    )
    db.add(new_quote)
    db.flush()
    
    for item in quote_data.line_items:
        line_item = QuoteLineItem(
            quote_id=new_quote.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.quantity * item.unit_price
        )
        db.add(line_item)
    
    db.commit()
    db.refresh(new_quote)
    return new_quote

@router.get("", response_model=List[QuoteResponse])
def get_quotes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "admin":
        quotes = db.query(Quote).all()
    else:
        quotes = db.query(Quote).filter(Quote.user_id == current_user.id).all()
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
    if quote_data.client_address is not None:
        quote.client_address = quote_data.client_address
    if quote_data.valid_until is not None:
        quote.valid_until = quote_data.valid_until
    if quote_data.status is not None:
        quote.status = quote_data.status
    if quote_data.notes is not None:
        quote.notes = quote_data.notes
    
    quote.pdf_url = None
    
    if quote_data.line_items is not None:
        db.query(QuoteLineItem).filter(QuoteLineItem.quote_id == quote_id).delete()
        
        subtotal = sum(item.quantity * item.unit_price for item in quote_data.line_items)
        
        for item in quote_data.line_items:
            line_item = QuoteLineItem(
                quote_id=quote.id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                total=item.quantity * item.unit_price
            )
            db.add(line_item)
        
        quote.subtotal = subtotal
    
    if "tax" in quote_data.model_fields_set:
        quote.tax = quote_data.tax or 0.0
        db.flush()
        current_line_items = db.query(QuoteLineItem).filter(QuoteLineItem.quote_id == quote_id).all()
        if current_line_items:
            quote.subtotal = sum(item.total for item in current_line_items)
        quote.total = quote.subtotal + quote.tax
    elif quote_data.line_items is not None:
        quote.total = quote.subtotal + (quote.tax or 0.0)
    
    quote.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(quote)
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
    
    db.delete(quote)
    db.commit()

@router.post("/{quote_id}/convert-to-invoice", response_model=InvoiceResponse)
def convert_to_invoice(
    quote_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quote not found")
    
    if current_user.role != "admin" and quote.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    
    if quote.status == QuoteStatus.converted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quote already converted")
    
    invoice_number = generate_invoice_number(db)
    
    new_invoice = Invoice(
        invoice_number=invoice_number,
        user_id=quote.user_id,
        client_name=quote.client_name,
        client_email=quote.client_email,
        client_address=quote.client_address,
        due_date=quote.valid_until,
        subtotal=quote.subtotal,
        tax=quote.tax,
        total=quote.total,
        notes=quote.notes
    )
    db.add(new_invoice)
    db.flush()
    
    for item in quote.line_items:
        invoice_line_item = InvoiceLineItem(
            invoice_id=new_invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.total
        )
        db.add(invoice_line_item)
    
    quote.status = QuoteStatus.converted
    quote.converted_to_invoice_id = new_invoice.id
    
    db.commit()
    db.refresh(new_invoice)
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
    
    if quote.status == QuoteStatus.draft:
        quote.status = QuoteStatus.sent
        db.commit()
    
    return {"message": "Email sent successfully"}
