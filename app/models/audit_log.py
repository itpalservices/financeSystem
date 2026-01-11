from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

class AuditAction(str, enum.Enum):
    login = "login"
    logout = "logout"
    create = "create"
    update = "update"
    delete = "delete"
    issue = "issue"
    cancel = "cancel"
    send_email = "send_email"
    generate_pdf = "generate_pdf"
    convert = "convert"

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    username = Column(String, nullable=True)
    
    action = Column(String, nullable=False, index=True)
    
    entity_type = Column(String, nullable=True, index=True)
    entity_id = Column(Integer, nullable=True)
    entity_number = Column(String, nullable=True)
    
    description = Column(Text, nullable=True)
    
    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", backref="audit_logs")
