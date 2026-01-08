from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, extract
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice, InvoiceStatus
from app.models.project import Project, ProjectStatus, Milestone
from app.auth import get_current_user

router = APIRouter()

class MonthlyData(BaseModel):
    month: int
    month_name: str
    total: float
    count: int

class YearlyData(BaseModel):
    year: int
    total: float
    count: int
    monthly_data: List[MonthlyData]

class AnalyticsResponse(BaseModel):
    total_issued_invoices: int
    total_issued_amount: float
    total_draft_invoices: int
    total_draft_amount: float
    current_year: int
    current_month: int
    current_month_total: float
    previous_month_total: float
    month_change_percent: Optional[float]
    current_year_total: float
    previous_year_total: float
    year_change_percent: Optional[float]
    available_years: List[int]
    yearly_data: List[YearlyData]

@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    today = date.today()
    current_year = today.year
    current_month = today.month
    
    month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    
    if current_user.role == "admin":
        base_query = db.query(Invoice)
    else:
        base_query = db.query(Invoice).filter(Invoice.user_id == current_user.id)
    
    issued_invoices = base_query.filter(Invoice.status == InvoiceStatus.issued).all()
    draft_invoices = base_query.filter(Invoice.status == InvoiceStatus.draft).all()
    
    total_issued_invoices = len(issued_invoices)
    total_issued_amount = sum(inv.total for inv in issued_invoices)
    total_draft_invoices = len(draft_invoices)
    total_draft_amount = sum(inv.total for inv in draft_invoices)
    
    current_month_invoices = [inv for inv in issued_invoices 
                              if inv.issue_date.year == current_year and inv.issue_date.month == current_month]
    current_month_total = sum(inv.total for inv in current_month_invoices)
    
    prev_month = current_month - 1 if current_month > 1 else 12
    prev_month_year = current_year if current_month > 1 else current_year - 1
    previous_month_invoices = [inv for inv in issued_invoices 
                               if inv.issue_date.year == prev_month_year and inv.issue_date.month == prev_month]
    previous_month_total = sum(inv.total for inv in previous_month_invoices)
    
    if previous_month_total > 0:
        month_change_percent = ((current_month_total - previous_month_total) / previous_month_total) * 100
    else:
        month_change_percent = None
    
    current_year_invoices = [inv for inv in issued_invoices if inv.issue_date.year == current_year]
    current_year_total = sum(inv.total for inv in current_year_invoices)
    
    previous_year_invoices = [inv for inv in issued_invoices if inv.issue_date.year == current_year - 1]
    previous_year_total = sum(inv.total for inv in previous_year_invoices)
    
    if previous_year_total > 0:
        year_change_percent = ((current_year_total - previous_year_total) / previous_year_total) * 100
    else:
        year_change_percent = None
    
    years = set(inv.issue_date.year for inv in issued_invoices)
    if not years:
        years = {current_year}
    available_years = sorted(years, reverse=True)
    
    yearly_data = []
    for year in available_years:
        year_invoices = [inv for inv in issued_invoices if inv.issue_date.year == year]
        year_total = sum(inv.total for inv in year_invoices)
        year_count = len(year_invoices)
        
        monthly_data = []
        for month in range(1, 13):
            month_invoices = [inv for inv in year_invoices if inv.issue_date.month == month]
            month_total = sum(inv.total for inv in month_invoices)
            month_count = len(month_invoices)
            monthly_data.append(MonthlyData(
                month=month,
                month_name=month_names[month - 1],
                total=round(month_total, 2),
                count=month_count
            ))
        
        yearly_data.append(YearlyData(
            year=year,
            total=round(year_total, 2),
            count=year_count,
            monthly_data=monthly_data
        ))
    
    return AnalyticsResponse(
        total_issued_invoices=total_issued_invoices,
        total_issued_amount=round(total_issued_amount, 2),
        total_draft_invoices=total_draft_invoices,
        total_draft_amount=round(total_draft_amount, 2),
        current_year=current_year,
        current_month=current_month,
        current_month_total=round(current_month_total, 2),
        previous_month_total=round(previous_month_total, 2),
        month_change_percent=round(month_change_percent, 1) if month_change_percent is not None else None,
        current_year_total=round(current_year_total, 2),
        previous_year_total=round(previous_year_total, 2),
        year_change_percent=round(year_change_percent, 1) if year_change_percent is not None else None,
        available_years=available_years,
        yearly_data=yearly_data
    )


class ProjectRevenueData(BaseModel):
    project_id: int
    project_code: str
    title: str
    customer_name: Optional[str]
    company_name: Optional[str]
    status: str
    budget: float
    invoiced_total: float
    invoice_count: int
    budget_utilization: Optional[float]

class MilestoneProgressData(BaseModel):
    milestone_id: int
    project_code: str
    project_title: str
    milestone_no: int
    label: str
    expected_amount: float
    invoiced_amount: float
    invoice_count: int
    status: str

class ProjectAnalyticsResponse(BaseModel):
    total_projects: int
    active_projects: int
    closed_projects: int
    total_project_revenue: float
    top_projects: List[ProjectRevenueData]
    milestone_progress: List[MilestoneProgressData]

@router.get("/projects", response_model=ProjectAnalyticsResponse)
def get_project_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get project-based analytics including revenue per project, top projects, and milestone progress."""
    
    # Get all projects with their customers
    projects = db.query(Project).options(joinedload(Project.customer)).all()
    
    total_projects = len(projects)
    active_projects = len([p for p in projects if p.status == ProjectStatus.active])
    closed_projects = len([p for p in projects if p.status == ProjectStatus.closed])
    
    # Calculate revenue per project
    project_revenues = []
    total_project_revenue = 0
    
    for project in projects:
        # Get issued invoices linked to this project
        invoices = db.query(Invoice).filter(
            Invoice.project_id == project.id,
            Invoice.status == InvoiceStatus.issued
        ).all()
        
        invoiced_total = sum(inv.total for inv in invoices)
        total_project_revenue += invoiced_total
        
        budget_utilization = None
        if project.total_budget and project.total_budget > 0:
            budget_utilization = round((invoiced_total / project.total_budget) * 100, 1)
        
        project_revenues.append(ProjectRevenueData(
            project_id=project.id,
            project_code=project.project_code,
            title=project.title,
            customer_name=project.customer.client_name if project.customer else None,
            company_name=project.customer.company_name if project.customer else None,
            status=project.status.value,
            budget=project.total_budget or 0,
            invoiced_total=round(invoiced_total, 2),
            invoice_count=len(invoices),
            budget_utilization=budget_utilization
        ))
    
    # Sort by invoiced_total descending and get top 10
    top_projects = sorted(project_revenues, key=lambda x: x.invoiced_total, reverse=True)[:10]
    
    # Get milestone progress
    milestones = db.query(Milestone).options(joinedload(Milestone.project)).all()
    milestone_progress = []
    
    for milestone in milestones:
        # Get issued invoices linked to this milestone
        invoices = db.query(Invoice).filter(
            Invoice.milestone_id == milestone.id,
            Invoice.status == InvoiceStatus.issued
        ).all()
        
        invoiced_amount = sum(inv.total for inv in invoices)
        
        # Determine status
        if len(invoices) == 0:
            status = "pending"
        elif milestone.expected_amount > 0 and abs(invoiced_amount - milestone.expected_amount) <= 0.01:
            status = "completed"
        elif invoiced_amount > 0:
            status = "partial"
        else:
            status = "pending"
        
        milestone_progress.append(MilestoneProgressData(
            milestone_id=milestone.id,
            project_code=milestone.project.project_code,
            project_title=milestone.project.title,
            milestone_no=milestone.milestone_no,
            label=milestone.label,
            expected_amount=milestone.expected_amount,
            invoiced_amount=round(invoiced_amount, 2),
            invoice_count=len(invoices),
            status=status
        ))
    
    # Sort milestones by project code and milestone number
    milestone_progress = sorted(milestone_progress, key=lambda x: (x.project_code, x.milestone_no))
    
    return ProjectAnalyticsResponse(
        total_projects=total_projects,
        active_projects=active_projects,
        closed_projects=closed_projects,
        total_project_revenue=round(total_project_revenue, 2),
        top_projects=top_projects,
        milestone_progress=milestone_progress
    )
