from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.database import Base

class ProjectStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    cancelled = "cancelled"

class MilestoneStatus(str, enum.Enum):
    planned = "planned"
    invoiced = "invoiced"
    partially_paid = "partially_paid"
    paid = "paid"

class MilestoneType(str, enum.Enum):
    advance = "advance"
    progress = "progress"
    final = "final"

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.active, nullable=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    total_budget = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    customer = relationship("Customer", backref="projects")
    user = relationship("User", backref="projects")
    milestones = relationship("Milestone", back_populates="project", cascade="all, delete-orphan", order_by="Milestone.milestone_no")
    invoices = relationship("Invoice", back_populates="project")
    quotes = relationship("Quote", back_populates="project")
    receipts = relationship("PaymentReceipt", back_populates="project")

class Milestone(Base):
    __tablename__ = "milestones"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    milestone_type = Column(Enum(MilestoneType), nullable=False)
    milestone_no = Column(Integer, nullable=True)
    label = Column(String, nullable=False)
    expected_amount = Column(Float, default=0.0)
    due_date = Column(DateTime, nullable=True)
    paid_date = Column(DateTime, nullable=True)
    status = Column(Enum(MilestoneStatus), default=MilestoneStatus.planned, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    project = relationship("Project", back_populates="milestones")
    invoices = relationship("Invoice", back_populates="milestone")
    quotes = relationship("Quote", back_populates="milestone")
    receipts = relationship("PaymentReceipt", back_populates="milestone")
