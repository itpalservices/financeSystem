from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base
from app.models.invoice import ContextType

class ReceiptStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    cancelled = "cancelled"

class PaymentMethod(str, enum.Enum):
    cash = "cash"
    bank_transfer = "bank_transfer"
    card = "card"
    cheque = "cheque"
    other = "other"

class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True, index=True)
    
    client_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    client_email = Column(String, nullable=True)
    telephone1 = Column(String, nullable=True)
    telephone2 = Column(String, nullable=True)
    client_address = Column(Text)
    client_reg_no = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True)
    
    context_type = Column(Enum(ContextType), default=ContextType.none, nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=True)
    
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.draft, nullable=False)
    receipt_date = Column(DateTime, default=datetime.utcnow)
    
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.bank_transfer, nullable=False)
    payment_reference = Column(String, nullable=True)
    
    amount = Column(Float, default=0.0)
    notes = Column(Text)
    pdf_url = Column(String)
    pdf_stored = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    issued_at = Column(DateTime, nullable=True)
    issued_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    
    customer_snapshot = Column(JSON, nullable=True)
    
    user = relationship("User", foreign_keys=[user_id])
    issuer = relationship("User", foreign_keys=[issued_by])
    canceller = relationship("User", foreign_keys=[cancelled_by])
    customer = relationship("Customer", back_populates="receipts")
    project = relationship("Project", back_populates="receipts")
    milestone = relationship("Milestone", back_populates="receipts")
    invoice = relationship("Invoice", backref="receipts")
