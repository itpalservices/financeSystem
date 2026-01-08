from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from app.models.user import UserRole
from app.models.invoice import InvoiceStatus
from app.models.quote import QuoteStatus
from app.models.project import ProjectStatus, MilestoneStatus

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = UserRole.user

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class CustomerBase(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    telephone1: str
    telephone2: Optional[str] = None
    address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    telephone1: str  # Required - unique identifier
    telephone2: Optional[str] = None
    address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class LineItemBase(BaseModel):
    description: str
    quantity: float
    unit_price: float
    discount: Optional[float] = 0.0

class LineItemCreate(LineItemBase):
    pass

class LineItemResponse(LineItemBase):
    id: int
    total: float
    
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: str  # Required for customer identification
    telephone2: Optional[str] = None
    client_address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0

class InvoiceCreate(InvoiceBase):
    line_items: List[LineItemCreate]

class InvoiceUpdate(BaseModel):
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: str  # Required for customer identification
    telephone2: Optional[str] = None
    client_address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[InvoiceStatus] = None
    notes: Optional[str] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    line_items: Optional[List[LineItemCreate]] = None

class InvoiceResponse(InvoiceBase):
    id: int
    invoice_number: str
    user_id: int
    status: InvoiceStatus
    issue_date: datetime
    subtotal: float
    discount: float
    total: float
    pdf_url: Optional[str] = None
    line_items: List[LineItemResponse]
    created_at: datetime
    updated_at: datetime
    issued_at: Optional[datetime] = None
    issued_by: Optional[int] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[int] = None
    cancel_reason: Optional[str] = None
    customer_snapshot: Optional[dict] = None
    
    class Config:
        from_attributes = True

class CancelRequest(BaseModel):
    reason: str

class QuoteBase(BaseModel):
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_address: Optional[str] = None
    valid_until: datetime
    notes: Optional[str] = None
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0

class QuoteCreate(QuoteBase):
    line_items: List[LineItemCreate]

class QuoteUpdate(BaseModel):
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_address: Optional[str] = None
    valid_until: Optional[datetime] = None
    status: Optional[QuoteStatus] = None
    notes: Optional[str] = None
    discount: Optional[float] = None
    tax: Optional[float] = None
    line_items: Optional[List[LineItemCreate]] = None

class QuoteResponse(QuoteBase):
    id: int
    quote_number: str
    user_id: int
    status: QuoteStatus
    issue_date: datetime
    subtotal: float
    discount: float
    total: float
    pdf_url: Optional[str] = None
    line_items: List[LineItemResponse]
    converted_to_invoice_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    issued_at: Optional[datetime] = None
    issued_by: Optional[int] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[int] = None
    cancel_reason: Optional[str] = None
    customer_snapshot: Optional[dict] = None
    
    class Config:
        from_attributes = True

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    message: Optional[str] = None

class EmailLogResponse(BaseModel):
    id: int
    email_type: str
    document_id: int
    document_number: str
    recipient_email: str
    subject: str
    message: str
    pdf_url: Optional[str] = None
    sent_at: datetime
    user_id: Optional[int] = None
    customer_id: Optional[int] = None
    telephone1: Optional[str] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    total_amount: Optional[float] = None
    
    class Config:
        from_attributes = True

class MilestoneBase(BaseModel):
    milestone_no: int
    label: str
    expected_amount: Optional[float] = 0.0
    due_date: Optional[datetime] = None
    status: Optional[MilestoneStatus] = MilestoneStatus.planned

class MilestoneCreate(MilestoneBase):
    pass

class MilestoneUpdate(BaseModel):
    milestone_no: Optional[int] = None
    label: Optional[str] = None
    expected_amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[MilestoneStatus] = None

class MilestoneResponse(MilestoneBase):
    id: int
    project_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    customer_id: int
    title: str
    description: Optional[str] = None
    status: Optional[ProjectStatus] = ProjectStatus.active
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    total_budget: Optional[float] = 0.0
    notes: Optional[str] = None

class ProjectCreate(ProjectBase):
    milestones: Optional[List[MilestoneCreate]] = None

class ProjectUpdate(BaseModel):
    customer_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    total_budget: Optional[float] = None
    notes: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: int
    project_code: str
    user_id: int
    created_at: datetime
    updated_at: datetime
    milestones: List[MilestoneResponse] = []
    
    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    id: int
    project_code: str
    customer_id: int
    customer_name: Optional[str] = None
    company_name: Optional[str] = None
    title: str
    status: ProjectStatus
    total_budget: float
    milestones_count: int = 0
    invoiced_amount: float = 0.0
    created_at: datetime
    
    class Config:
        from_attributes = True
