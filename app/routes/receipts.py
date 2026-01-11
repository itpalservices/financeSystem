from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime

from app.database import get_db
from app.models import PaymentReceipt, ReceiptStatus, User, Customer, Invoice
from app.models.customer import CustomerStatus
from app.models.invoice import ContextType
from app.models.project import Milestone, MilestoneStatus
from app.schemas import ReceiptCreate, ReceiptUpdate, ReceiptResponse, CancelRequest
from app.auth import get_current_user
from app.services.validation import (
    validate_document_context,
    get_customer_snapshot,
    populate_document_fields_from_customer,
    validate_document_immutability
)
from app.services.audit import log_action

router = APIRouter()


def update_milestone_status(db: Session, milestone_id: int, payment_date: datetime = None):
    """Update milestone status and paid_date based on total received payments."""
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        return
    
    received_amount = db.query(func.coalesce(func.sum(PaymentReceipt.amount), 0)).filter(
        PaymentReceipt.milestone_id == milestone_id,
        PaymentReceipt.status == ReceiptStatus.issued
    ).scalar() or 0.0
    
    expected = milestone.expected_amount or 0.0
    
    if received_amount <= 0:
        milestone.status = MilestoneStatus.planned
        milestone.paid_date = None
    elif received_amount < expected:
        milestone.status = MilestoneStatus.partially_paid
        if not milestone.paid_date and payment_date:
            milestone.paid_date = payment_date
    else:
        milestone.status = MilestoneStatus.paid
        if not milestone.paid_date and payment_date:
            milestone.paid_date = payment_date


def generate_receipt_number(db: Session) -> str:
    """Generate year-based receipt number: REC-YYYY-NNNNNN"""
    current_year = datetime.utcnow().year
    
    last_receipt = db.query(PaymentReceipt).filter(
        PaymentReceipt.receipt_number.like(f"REC-{current_year}-%")
    ).order_by(PaymentReceipt.receipt_number.desc()).first()
    
    if last_receipt:
        last_number = int(last_receipt.receipt_number.split("-")[-1])
        new_number = last_number + 1
    else:
        new_number = 1
    
    return f"REC-{current_year}-{new_number:06d}"


@router.get("/", response_model=List[ReceiptResponse])
async def get_receipts(
    skip: int = 0,
    limit: int = 100,
    status: ReceiptStatus = None,
    customer_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all payment receipts with optional filtering."""
    query = db.query(PaymentReceipt)
    
    if status:
        query = query.filter(PaymentReceipt.status == status)
    
    if customer_id:
        query = query.filter(PaymentReceipt.customer_id == customer_id)
    
    receipts = query.order_by(PaymentReceipt.created_at.desc()).offset(skip).limit(limit).all()
    return receipts


@router.get("/{receipt_id}", response_model=ReceiptResponse)
async def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific payment receipt."""
    receipt = db.query(PaymentReceipt).filter(PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.post("/", response_model=ReceiptResponse)
async def create_receipt(
    receipt_data: ReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new payment receipt."""
    context = validate_document_context(
        db,
        customer_id=receipt_data.customer_id,
        project_id=receipt_data.project_id,
        milestone_id=receipt_data.milestone_id,
        context_type=receipt_data.context_type.value if receipt_data.context_type else "none"
    )
    
    receipt_number = generate_receipt_number(db)
    
    receipt = PaymentReceipt(
        receipt_number=receipt_number,
        user_id=current_user.id,
        customer_id=receipt_data.customer_id,
        context_type=ContextType(context["context_type"]),
        project_id=context["project_id"],
        milestone_id=context["milestone_id"],
        invoice_id=receipt_data.invoice_id,
        status=ReceiptStatus.draft,
        receipt_date=receipt_data.receipt_date or datetime.utcnow(),
        payment_method=receipt_data.payment_method,
        payment_reference=receipt_data.payment_reference,
        amount=receipt_data.amount,
        notes=receipt_data.notes
    )
    
    if receipt_data.customer_id:
        customer_fields = populate_document_fields_from_customer(db, receipt_data.customer_id)
        for field, value in customer_fields.items():
            setattr(receipt, field, value)
    else:
        receipt.client_name = receipt_data.client_name
        receipt.company_name = receipt_data.company_name
        receipt.client_email = receipt_data.client_email
        receipt.telephone1 = receipt_data.telephone1
        receipt.telephone2 = receipt_data.telephone2
        receipt.client_address = receipt_data.client_address
        receipt.client_reg_no = receipt_data.client_reg_no
        receipt.client_tax_id = receipt_data.client_tax_id
    
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    
    log_action(
        db,
        action="create",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="receipt",
        entity_id=receipt.id,
        entity_number=receipt.receipt_number,
        description=f"Created payment receipt {receipt.receipt_number}"
    )
    
    return receipt


@router.put("/{receipt_id}", response_model=ReceiptResponse)
async def update_receipt(
    receipt_id: int,
    receipt_data: ReceiptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an existing payment receipt."""
    receipt = db.query(PaymentReceipt).filter(PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    validate_document_immutability(receipt.status.value, "edit")
    
    if receipt_data.customer_id or receipt_data.project_id or receipt_data.milestone_id:
        context = validate_document_context(
            db,
            customer_id=receipt_data.customer_id or receipt.customer_id,
            project_id=receipt_data.project_id,
            milestone_id=receipt_data.milestone_id,
            context_type=receipt_data.context_type.value if receipt_data.context_type else receipt.context_type.value
        )
        receipt.context_type = ContextType(context["context_type"])
        receipt.project_id = context["project_id"]
        receipt.milestone_id = context["milestone_id"]
    
    update_data = receipt_data.model_dump(exclude_unset=True)
    
    if "customer_id" in update_data and update_data["customer_id"]:
        customer_fields = populate_document_fields_from_customer(db, update_data["customer_id"])
        for field, value in customer_fields.items():
            setattr(receipt, field, value)
        receipt.customer_id = update_data["customer_id"]
    
    for field in ["client_name", "company_name", "client_email", "telephone1", "telephone2",
                  "client_address", "client_reg_no", "client_tax_id", "invoice_id",
                  "receipt_date", "payment_method", "payment_reference", "amount", "notes"]:
        if field in update_data:
            setattr(receipt, field, update_data[field])
    
    db.commit()
    db.refresh(receipt)
    
    log_action(
        db,
        action="update",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="receipt",
        entity_id=receipt.id,
        entity_number=receipt.receipt_number,
        description=f"Updated payment receipt {receipt.receipt_number}"
    )
    
    return receipt


@router.post("/{receipt_id}/issue", response_model=ReceiptResponse)
async def issue_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Issue a payment receipt (makes it immutable)."""
    receipt = db.query(PaymentReceipt).filter(PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    if receipt.status != ReceiptStatus.draft:
        raise HTTPException(status_code=400, detail="Only draft receipts can be issued")
    
    if receipt.customer_id:
        receipt.customer_snapshot = get_customer_snapshot(db, receipt.customer_id)
        customer = db.query(Customer).filter(Customer.id == receipt.customer_id).first()
        if customer and customer.status == CustomerStatus.potential:
            customer.status = CustomerStatus.active
    
    receipt.status = ReceiptStatus.issued
    receipt.issued_at = datetime.utcnow()
    receipt.issued_by = current_user.id
    
    if receipt.milestone_id:
        payment_date = receipt.receipt_date or datetime.utcnow()
        update_milestone_status(db, receipt.milestone_id, payment_date)
    
    db.commit()
    db.refresh(receipt)
    
    log_action(
        db,
        action="issue",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="receipt",
        entity_id=receipt.id,
        entity_number=receipt.receipt_number,
        description=f"Issued payment receipt {receipt.receipt_number}"
    )
    
    return receipt


@router.post("/{receipt_id}/cancel", response_model=ReceiptResponse)
async def cancel_receipt(
    receipt_id: int,
    cancel_request: CancelRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a payment receipt (void)."""
    receipt = db.query(PaymentReceipt).filter(PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    if receipt.status == ReceiptStatus.cancelled:
        raise HTTPException(status_code=400, detail="Receipt is already cancelled")
    
    if receipt.status == ReceiptStatus.draft:
        raise HTTPException(status_code=400, detail="Draft receipts should be deleted, not cancelled. Only issued receipts can be cancelled.")
    
    if not cancel_request.reason:
        raise HTTPException(status_code=400, detail="Cancel reason is required")
    
    receipt.status = ReceiptStatus.cancelled
    receipt.cancelled_at = datetime.utcnow()
    receipt.cancelled_by = current_user.id
    receipt.cancel_reason = cancel_request.reason
    
    if receipt.milestone_id:
        update_milestone_status(db, receipt.milestone_id)
    
    db.commit()
    db.refresh(receipt)
    
    log_action(
        db,
        action="cancel",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="receipt",
        entity_id=receipt.id,
        entity_number=receipt.receipt_number,
        description=f"Cancelled payment receipt {receipt.receipt_number}: {cancel_request.reason}"
    )
    
    return receipt


@router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a draft receipt."""
    receipt = db.query(PaymentReceipt).filter(PaymentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    validate_document_immutability(receipt.status.value, "delete")
    
    receipt_number = receipt.receipt_number
    db.delete(receipt)
    db.commit()
    
    log_action(
        db,
        action="delete",
        user_id=current_user.id,
        username=current_user.username,
        entity_type="receipt",
        entity_id=receipt_id,
        entity_number=receipt_number,
        description=f"Deleted draft payment receipt {receipt_number}"
    )
    
    return {"message": "Receipt deleted successfully"}
