from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    telephone1 = Column(String, nullable=False, index=True)  # Primary identifier
    telephone2 = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    client_reg_no = Column(String, nullable=True)
    client_tax_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
