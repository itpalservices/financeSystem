from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from app.models.user import UserRole
from app.models.invoice import InvoiceStatus, ContextType
from app.models.quote import QuoteStatus
from app.models.project import ProjectStatus, MilestoneStatus, MilestoneType
from app.models.receipt import ReceiptStatus, PaymentMethod

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
    customer_type: str = "individual"
    display_name: str
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    status: str = "potential"
    internal_notes: Optional[str] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    customer_type: Optional[str] = None
    display_name: Optional[str] = None
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    internal_notes: Optional[str] = None
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
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    context_type: Optional[ContextType] = ContextType.none
    project_id: Optional[int] = None
    milestone_id: Optional[int] = None
    due_date: Optional[datetime] = None
    notes: Optional[str] = None
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0

class InvoiceCreate(InvoiceBase):
    line_items: List[LineItemCreate]

class InvoiceUpdate(BaseModel):
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    context_type: Optional[ContextType] = None
    project_id: Optional[int] = None
    milestone_id: Optional[int] = None
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
    pdf_stored: Optional[str] = None
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
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_address: Optional[str] = None
    context_type: Optional[ContextType] = ContextType.none
    project_id: Optional[int] = None
    milestone_id: Optional[int] = None
    valid_until: datetime
    notes: Optional[str] = None
    discount: Optional[float] = 0.0
    tax: Optional[float] = 0.0

class QuoteCreate(QuoteBase):
    line_items: List[LineItemCreate]

class QuoteUpdate(BaseModel):
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    client_address: Optional[str] = None
    context_type: Optional[ContextType] = None
    project_id: Optional[int] = None
    milestone_id: Optional[int] = None
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
    pdf_stored: Optional[str] = None
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
    milestone_type: MilestoneType
    expected_amount: Optional[float] = 0.0
    due_date: Optional[datetime] = None

class MilestoneCreate(MilestoneBase):
    pass

class MilestoneUpdate(BaseModel):
    expected_amount: Optional[float] = None
    due_date: Optional[datetime] = None
    status: Optional[MilestoneStatus] = None

class MilestoneResponse(BaseModel):
    id: int
    project_id: int
    milestone_type: MilestoneType
    milestone_no: Optional[int] = None
    label: str
    expected_amount: float
    due_date: Optional[datetime] = None
    status: MilestoneStatus
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

class ReceiptBase(BaseModel):
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    context_type: Optional[ContextType] = ContextType.none
    project_id: Optional[int] = None
    milestone_id: Optional[int] = None
    invoice_id: Optional[int] = None
    receipt_date: Optional[datetime] = None
    payment_method: Optional[PaymentMethod] = PaymentMethod.bank_transfer
    payment_reference: Optional[str] = None
    amount: float = 0.0
    notes: Optional[str] = None

class ReceiptCreate(ReceiptBase):
    pass

class ReceiptUpdate(BaseModel):
    customer_id: Optional[int] = None
    client_name: Optional[str] = None
    company_name: Optional[str] = None
    client_email: Optional[str] = None
    telephone1: Optional[str] = None
    telephone2: Optional[str] = None
    client_address: Optional[str] = None
    client_reg_no: Optional[str] = None
    client_tax_id: Optional[str] = None
    context_type: Optional[ContextType] = None
    project_id: Optional[int] = None
    milestone_id: Optional[int] = None
    invoice_id: Optional[int] = None
    receipt_date: Optional[datetime] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    amount: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[ReceiptStatus] = None

class ReceiptResponse(ReceiptBase):
    id: int
    receipt_number: str
    user_id: int
    status: ReceiptStatus
    pdf_url: Optional[str] = None
    pdf_stored: Optional[str] = None
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

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_number: Optional[str] = None
    description: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
