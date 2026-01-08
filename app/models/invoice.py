from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    cancelled = "cancelled"

class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    client_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    client_email = Column(String, nullable=True)
    telephone1 = Column(String, nullable=True)
    telephone2 = Column(String, nullable=True)
    client_address = Column(Text)
    client_reg_no = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.draft, nullable=False)
    issue_date = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    subtotal = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    notes = Column(Text)
    pdf_url = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    issued_at = Column(DateTime, nullable=True)
    issued_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    cancelled_at = Column(DateTime, nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    
    customer_snapshot = Column(JSON, nullable=True)
    
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    milestone_id = Column(Integer, ForeignKey("milestones.id"), nullable=True)
    
    user = relationship("User", back_populates="invoices", foreign_keys=[user_id])
    issuer = relationship("User", foreign_keys=[issued_by])
    canceller = relationship("User", foreign_keys=[cancelled_by])
    line_items = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    project = relationship("Project", back_populates="invoices")
    milestone = relationship("Milestone", back_populates="invoices")

class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"
    
    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    
    invoice = relationship("Invoice", back_populates="line_items")
