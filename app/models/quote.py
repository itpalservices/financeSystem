from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

class QuoteStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    invoiced = "invoiced"
    voided = "voided"

class Quote(Base):
    __tablename__ = "quotes"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_number = Column(String, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    client_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    client_email = Column(String, nullable=True)
    telephone1 = Column(String, nullable=True)
    telephone2 = Column(String, nullable=True)
    client_reg_no = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True)
    client_address = Column(Text)
    status = Column(Enum(QuoteStatus), default=QuoteStatus.draft, nullable=False)
    issue_date = Column(DateTime, default=datetime.utcnow)
    valid_until = Column(DateTime, nullable=False)
    subtotal = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    notes = Column(Text)
    pdf_url = Column(String)
    converted_to_invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    issued_at = Column(DateTime, nullable=True)
    issued_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    voided_at = Column(DateTime, nullable=True)
    voided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    void_reason = Column(Text, nullable=True)
    
    customer_snapshot = Column(JSON, nullable=True)
    
    user = relationship("User", back_populates="quotes", foreign_keys=[user_id])
    issuer = relationship("User", foreign_keys=[issued_by])
    voider = relationship("User", foreign_keys=[voided_by])
    line_items = relationship("QuoteLineItem", back_populates="quote", cascade="all, delete-orphan")

class QuoteLineItem(Base):
    __tablename__ = "quote_line_items"
    
    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"), nullable=False)
    description = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    discount = Column(Float, default=0.0)
    total = Column(Float, nullable=False)
    
    quote = relationship("Quote", back_populates="line_items")
