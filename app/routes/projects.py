from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, extract
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.user import User
from app.models.customer import Customer
from app.models.project import Project, Milestone, ProjectStatus, MilestoneStatus
from app.models.invoice import Invoice, InvoiceStatus
from app.schemas import (
    ProjectCreate, ProjectResponse, ProjectUpdate, ProjectListResponse,
    MilestoneCreate, MilestoneResponse, MilestoneUpdate
)
from app.auth import get_current_user

router = APIRouter()

def generate_project_code(db: Session) -> str:
    current_year = datetime.utcnow().year
    year_prefix = f"PRJ-{current_year}-"
    
    last_project = db.query(Project).filter(
        Project.project_code.like(f"{year_prefix}%")
    ).order_by(Project.project_code.desc()).first()
    
    if last_project:
        try:
            last_number = int(last_project.project_code.split("-")[-1])
            new_number = last_number + 1
        except (ValueError, IndexError):
            new_number = 1
    else:
        new_number = 1
    
    return f"{year_prefix}{new_number:06d}"

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(Customer.id == project_data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    project_code = generate_project_code(db)
    
    new_project = Project(
        project_code=project_code,
        customer_id=project_data.customer_id,
        user_id=current_user.id,
        title=project_data.title,
        description=project_data.description,
        status=project_data.status or ProjectStatus.active,
        start_date=project_data.start_date,
        end_date=project_data.end_date,
        total_budget=project_data.total_budget or 0.0,
        notes=project_data.notes
    )
    db.add(new_project)
    db.flush()
    
    if project_data.milestones:
        for milestone_data in project_data.milestones:
            milestone = Milestone(
                project_id=new_project.id,
                milestone_no=milestone_data.milestone_no,
                label=milestone_data.label,
                expected_amount=milestone_data.expected_amount or 0.0,
                due_date=milestone_data.due_date,
                status=milestone_data.status or MilestoneStatus.planned
            )
            db.add(milestone)
    
    db.commit()
    db.refresh(new_project)
    return new_project

@router.get("", response_model=List[ProjectListResponse])
def get_projects(
    search: str = "",
    status_filter: str = "",
    customer_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Project)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                func.lower(Project.project_code).like(func.lower(search_pattern)),
                func.lower(Project.title).like(func.lower(search_pattern)),
                func.lower(Project.description).like(func.lower(search_pattern))
            )
        )
    
    if status_filter:
        query = query.filter(Project.status == status_filter)
    
    if customer_id:
        query = query.filter(Project.customer_id == customer_id)
    
    projects = query.order_by(Project.created_at.desc()).all()
    
    result = []
    for project in projects:
        customer = db.query(Customer).filter(Customer.id == project.customer_id).first()
        
        invoiced_amount = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(
            Invoice.project_id == project.id,
            Invoice.status != InvoiceStatus.cancelled
        ).scalar() or 0.0
        
        result.append(ProjectListResponse(
            id=project.id,
            project_code=project.project_code,
            customer_id=project.customer_id,
            customer_name=customer.name if customer else None,
            company_name=customer.company_name if customer else None,
            title=project.title,
            status=project.status,
            total_budget=project.total_budget,
            milestones_count=len(project.milestones),
            invoiced_amount=invoiced_amount,
            created_at=project.created_at
        ))
    
    return result

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    if project_data.customer_id:
        customer = db.query(Customer).filter(Customer.id == project_data.customer_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    
    update_data = project_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    linked_invoices = db.query(Invoice).filter(Invoice.project_id == project_id).count()
    if linked_invoices > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete project. {linked_invoices} invoice(s) are linked to it."
        )
    
    db.delete(project)
    db.commit()

@router.post("/{project_id}/milestones", response_model=MilestoneResponse, status_code=status.HTTP_201_CREATED)
def add_milestone(
    project_id: int,
    milestone_data: MilestoneCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    milestone = Milestone(
        project_id=project_id,
        milestone_no=milestone_data.milestone_no,
        label=milestone_data.label,
        expected_amount=milestone_data.expected_amount or 0.0,
        due_date=milestone_data.due_date,
        status=milestone_data.status or MilestoneStatus.planned
    )
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone

@router.get("/{project_id}/milestones", response_model=List[MilestoneResponse])
def get_milestones(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    return project.milestones

@router.put("/{project_id}/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_milestone(
    project_id: int,
    milestone_id: int,
    milestone_data: MilestoneUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id,
        Milestone.project_id == project_id
    ).first()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    
    update_data = milestone_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(milestone, field, value)
    
    db.commit()
    db.refresh(milestone)
    return milestone

@router.delete("/{project_id}/milestones/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    project_id: int,
    milestone_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id,
        Milestone.project_id == project_id
    ).first()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    
    linked_invoices = db.query(Invoice).filter(Invoice.milestone_id == milestone_id).count()
    if linked_invoices > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete milestone. {linked_invoices} invoice(s) are linked to it."
        )
    
    db.delete(milestone)
    db.commit()

@router.get("/search/dropdown")
def search_projects_dropdown(
    search: str = "",
    customer_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Project).filter(Project.status == ProjectStatus.active)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                func.lower(Project.project_code).like(func.lower(search_pattern)),
                func.lower(Project.title).like(func.lower(search_pattern))
            )
        )
    
    if customer_id:
        query = query.filter(Project.customer_id == customer_id)
    
    projects = query.order_by(Project.created_at.desc()).limit(20).all()
    
    result = []
    for project in projects:
        customer = db.query(Customer).filter(Customer.id == project.customer_id).first()
        result.append({
            "id": project.id,
            "project_code": project.project_code,
            "title": project.title,
            "customer_id": project.customer_id,
            "customer_name": customer.name if customer else None,
            "company_name": customer.company_name if customer else None,
            "total_budget": project.total_budget
        })
    
    return result

@router.get("/{project_id}/invoices")
def get_project_invoices(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    invoices = db.query(Invoice).filter(Invoice.project_id == project_id).order_by(Invoice.created_at.desc()).all()
    
    result = []
    for invoice in invoices:
        milestone = None
        if invoice.milestone_id:
            m = db.query(Milestone).filter(Milestone.id == invoice.milestone_id).first()
            if m:
                milestone = {"id": m.id, "label": m.label, "milestone_no": m.milestone_no}
        
        result.append({
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "status": invoice.status.value,
            "total": invoice.total,
            "issue_date": invoice.issue_date.isoformat() if invoice.issue_date else None,
            "milestone": milestone
        })
    
    return result

@router.get("/{project_id}/summary")
def get_project_summary(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    
    customer = db.query(Customer).filter(Customer.id == project.customer_id).first()
    
    invoiced_total = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(
        Invoice.project_id == project_id,
        Invoice.status != InvoiceStatus.cancelled
    ).scalar() or 0.0
    
    issued_total = db.query(func.coalesce(func.sum(Invoice.total), 0)).filter(
        Invoice.project_id == project_id,
        Invoice.status == InvoiceStatus.issued
    ).scalar() or 0.0
    
    milestones_summary = []
    for milestone in project.milestones:
        milestone_invoices = db.query(Invoice).filter(
            Invoice.milestone_id == milestone.id,
            Invoice.status != InvoiceStatus.cancelled
        ).all()
        
        milestone_total = sum(inv.total for inv in milestone_invoices)
        
        milestones_summary.append({
            "id": milestone.id,
            "milestone_no": milestone.milestone_no,
            "label": milestone.label,
            "expected_amount": milestone.expected_amount,
            "invoiced_amount": milestone_total,
            "due_date": milestone.due_date.isoformat() if milestone.due_date else None,
            "status": milestone.status.value,
            "invoices_count": len(milestone_invoices)
        })
    
    return {
        "project": {
            "id": project.id,
            "project_code": project.project_code,
            "title": project.title,
            "description": project.description,
            "status": project.status.value,
            "start_date": project.start_date.isoformat() if project.start_date else None,
            "end_date": project.end_date.isoformat() if project.end_date else None,
            "total_budget": project.total_budget,
            "notes": project.notes
        },
        "customer": {
            "id": customer.id if customer else None,
            "name": customer.name if customer else None,
            "company_name": customer.company_name if customer else None,
            "email": customer.email if customer else None,
            "telephone1": customer.telephone1 if customer else None
        },
        "financial": {
            "total_budget": project.total_budget,
            "invoiced_total": invoiced_total,
            "remaining": project.total_budget - invoiced_total,
            "progress_percent": (invoiced_total / project.total_budget * 100) if project.total_budget > 0 else 0
        },
        "milestones": milestones_summary
    }
