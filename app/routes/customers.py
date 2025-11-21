from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.schemas import CustomerCreate, CustomerResponse, CustomerUpdate
from app.auth import get_current_user

router = APIRouter()

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_data: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if customer with this telephone already exists
    existing_customer = db.query(Customer).filter(
        Customer.telephone1 == customer_data.telephone1
    ).first()
    
    if existing_customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer with this telephone number already exists"
        )
    
    new_customer = Customer(
        name=customer_data.name,
        company_name=customer_data.company_name,
        email=customer_data.email,
        telephone1=customer_data.telephone1,
        telephone2=customer_data.telephone2,
        address=customer_data.address,
        client_reg_no=customer_data.client_reg_no,
        client_tax_id=customer_data.client_tax_id,
        notes=customer_data.notes
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    
    return new_customer

@router.get("", response_model=List[CustomerResponse])
def get_customers(
    search: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Customer)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                func.lower(Customer.name).like(func.lower(search_pattern)),
                func.lower(Customer.company_name).like(func.lower(search_pattern)),
                func.lower(Customer.email).like(func.lower(search_pattern)),
                func.lower(Customer.telephone1).like(func.lower(search_pattern)),
                func.lower(Customer.telephone2).like(func.lower(search_pattern))
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
    
    # Check if telephone1 is being changed and if it conflicts with another customer
    if customer_data.telephone1 and customer_data.telephone1 != customer.telephone1:
        existing = db.query(Customer).filter(
            Customer.telephone1 == customer_data.telephone1,
            Customer.id != customer_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Another customer with this telephone number already exists"
            )
    
    update_data = customer_data.dict(exclude_unset=True)
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
