"""
Validation helpers for document business rules.
Enforces:
1. document.customer_id must match project.customer_id when project_id is set
2. milestone.project_id must match document.project_id when milestone_id is set
3. context_type must be 'project' when project_id is set
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Customer, Project, Milestone


def validate_document_context(
    db: Session,
    customer_id: int = None,
    project_id: int = None,
    milestone_id: int = None,
    context_type: str = "none"
) -> dict:
    """
    Validate document business context rules.
    Returns validated context_type based on provided data.
    Raises HTTPException if validation fails.
    """
    
    if customer_id:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=400, detail="Customer not found")
        if not customer.is_active:
            raise HTTPException(status_code=400, detail="Customer is inactive")
    
    if project_id:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=400, detail="Project not found")
        
        if customer_id and project.customer_id != customer_id:
            raise HTTPException(
                status_code=400,
                detail=f"Project belongs to a different customer. Document customer must match project customer."
            )
        
        context_type = "project"
    
    if milestone_id:
        milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
        if not milestone:
            raise HTTPException(status_code=400, detail="Milestone not found")
        
        if project_id and milestone.project_id != project_id:
            raise HTTPException(
                status_code=400,
                detail="Milestone does not belong to the selected project"
            )
        
        if not project_id:
            project_id = milestone.project_id
            project = db.query(Project).filter(Project.id == project_id).first()
            
            if customer_id and project.customer_id != customer_id:
                raise HTTPException(
                    status_code=400,
                    detail="Milestone's project belongs to a different customer"
                )
            
            context_type = "project"
    
    return {
        "context_type": context_type,
        "project_id": project_id,
        "milestone_id": milestone_id
    }


def get_customer_snapshot(db: Session, customer_id: int) -> dict:
    """
    Create a snapshot of customer data to freeze at document issue time.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return None
    
    return {
        "id": customer.id,
        "name": customer.name,
        "company_name": customer.company_name,
        "email": customer.email,
        "telephone1": customer.telephone1,
        "telephone2": customer.telephone2,
        "address": customer.address,
        "client_reg_no": customer.client_reg_no,
        "client_tax_id": customer.client_tax_id
    }


def populate_document_fields_from_customer(db: Session, customer_id: int) -> dict:
    """
    Get customer fields to populate document client_* fields.
    Used when creating/updating documents to sync customer data.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return {}
    
    return {
        "client_name": customer.name,
        "company_name": customer.company_name,
        "client_email": customer.email,
        "telephone1": customer.telephone1,
        "telephone2": customer.telephone2,
        "client_address": customer.address,
        "client_reg_no": customer.client_reg_no,
        "client_tax_id": customer.client_tax_id
    }


def validate_document_immutability(status: str, action: str = "edit"):
    """
    Check if document can be modified based on its status.
    Issued documents cannot be edited or deleted - only cancelled.
    """
    if status == "issued" and action == "edit":
        raise HTTPException(
            status_code=400,
            detail="Cannot edit an issued document. Cancel it first if corrections are needed."
        )
    
    if status == "issued" and action == "delete":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete an issued document. Use cancel/void instead."
        )
    
    if status == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Cannot modify a cancelled document."
        )
