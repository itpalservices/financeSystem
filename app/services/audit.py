"""
Audit logging service for tracking critical actions.
"""

from sqlalchemy.orm import Session
from datetime import datetime
from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    action: str,
    user_id: int = None,
    username: str = None,
    entity_type: str = None,
    entity_id: int = None,
    entity_number: str = None,
    description: str = None,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None,
    user_agent: str = None
):
    """
    Log an action to the audit trail.
    
    Actions: login, logout, create, update, delete, issue, cancel, send_email, generate_pdf, convert
    """
    audit_entry = AuditLog(
        user_id=user_id,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_number=entity_number,
        description=description,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow()
    )
    
    db.add(audit_entry)
    db.commit()
    
    return audit_entry
