from app.services.validation import (
    validate_document_context,
    get_customer_snapshot,
    populate_document_fields_from_customer,
    validate_document_immutability
)
from app.services.audit import log_action
