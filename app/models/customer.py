from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base


class CustomerType(str, enum.Enum):
    COMPANY = "company"
    INDIVIDUAL = "individual"


class CustomerStatus(str, enum.Enum):
    POTENTIAL = "potential"
    ACTIVE = "active"
    INACTIVE = "inactive"


class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_type = Column(SQLEnum(CustomerType), default=CustomerType.INDIVIDUAL, nullable=False)
    display_name = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    email = Column(String, nullable=True, index=True)
    telephone1 = Column(String, nullable=True, index=True)
    telephone2 = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    client_reg_no = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True, index=True)
    status = Column(SQLEnum(CustomerStatus), default=CustomerStatus.POTENTIAL, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    internal_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    invoices = relationship("Invoice", back_populates="customer")
    quotes = relationship("Quote", back_populates="customer")
    receipts = relationship("PaymentReceipt", back_populates="customer")
