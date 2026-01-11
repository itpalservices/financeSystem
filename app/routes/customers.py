from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List, Optional

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer, CustomerType, CustomerStatus
from app.models.email_log import EmailLog
from app.schemas import CustomerCreate, CustomerResponse, CustomerUpdate, EmailLogResponse
from app.auth import get_current_user

router = APIRouter()

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer_type_str = customer_data.customer_type.lower() if customer_data.customer_type else 'individual'
    customer_status_str = customer_data.status.lower() if customer_data.status else 'potential'
    customer_type = CustomerType(customer_type_str)
    customer_status = CustomerStatus(customer_status_str)
    
    new_customer = Customer(
        customer_type=customer_type,
        display_name=customer_data.display_name,
        name=customer_data.name,
        company_name=customer_data.company_name,
        email=customer_data.email,
        telephone1=customer_data.telephone1,
        telephone2=customer_data.telephone2,
        address=customer_data.address,
        client_reg_no=customer_data.client_reg_no,
        client_tax_id=customer_data.client_tax_id,
        status=customer_status,
        internal_notes=customer_data.internal_notes,
        notes=customer_data.notes
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    
    return new_customer

@router.get("", response_model=List[CustomerResponse])
def get_customers(
    search: str = "",
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Customer)
    
    if status_filter:
        try:
            status_enum = CustomerStatus(status_filter.lower())
            query = query.filter(Customer.status == status_enum)
        except ValueError:
            pass
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                func.lower(Customer.display_name).like(func.lower(search_pattern)),
                func.lower(Customer.name).like(func.lower(search_pattern)),
                func.lower(Customer.company_name).like(func.lower(search_pattern)),
                func.lower(Customer.email).like(func.lower(search_pattern)),
                func.lower(Customer.telephone1).like(func.lower(search_pattern)),
                func.lower(Customer.telephone2).like(func.lower(search_pattern)),
                func.lower(Customer.client_tax_id).like(func.lower(search_pattern))
            )
        )
    
    customers = query.order_by(Customer.created_at.desc()).all()
    return customers

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.get("/by-phone/{telephone}", response_model=CustomerResponse)
def get_customer_by_phone(
    telephone: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.telephone1 == telephone).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    customer_data: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = customer_data.dict(exclude_unset=True)
    
    if 'customer_type' in update_data and update_data['customer_type']:
        update_data['customer_type'] = CustomerType(update_data['customer_type'].lower())
    
    if 'status' in update_data and update_data['status']:
        update_data['status'] = CustomerStatus(update_data['status'].lower())
    
    for field, value in update_data.items():
        setattr(customer, field, value)
    
    db.commit()
    db.refresh(customer)
    
    return customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    db.delete(customer)
    db.commit()
    
    return None

@router.patch("/{customer_id}/toggle-status", response_model=CustomerResponse)
def toggle_customer_status(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer.is_active = not customer.is_active
    db.commit()
    db.refresh(customer)
    
    return customer

@router.get("/{customer_id}/email-history", response_model=List[EmailLogResponse])
def get_customer_email_history(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    email_logs = db.query(EmailLog).filter(
        or_(
            EmailLog.customer_id == customer_id,
            EmailLog.telephone1 == customer.telephone1
        )
    ).order_by(EmailLog.sent_at.desc()).all()
    
    return email_logs

@router.get("/email-history/all", response_model=List[EmailLogResponse])
def get_all_email_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    email_logs = db.query(EmailLog).order_by(EmailLog.sent_at.desc()).all()
    return email_logs
