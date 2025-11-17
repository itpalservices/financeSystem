from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SQLEnum
from datetime import datetime
import enum

from app.database import Base

class EmailType(enum.Enum):
    invoice = "invoice"
    quote = "quote"

class EmailLog(Base):
    __tablename__ = "email_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    email_type = Column(SQLEnum(EmailType), nullable=False)
    document_id = Column(Integer, nullable=False)
    document_number = Column(String, nullable=False)
    recipient_email = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    pdf_url = Column(String)
    sent_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"))
