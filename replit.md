# Invoice & Quote Management System

## Overview
This project is a full-stack invoice and quote management system designed to streamline business operations for I.T. PAL Technology Solutions Ltd. It provides functionalities for creating, managing, and sending professional invoices and quotes. The system includes user authentication, role-based access, PDF generation, and email notifications. The goal is to enhance efficiency in financial documentation and client communication, thereby improving client communication and overall business operations.

## User Preferences
### Branding
- **Company**: I.T. PAL Technology Solutions Ltd
- **Color Scheme**: Teal/Blue (#1b7ca8 primary, #155a7a secondary)
- **Logo**: Located at `static/logo.png` - used throughout application and PDFs

### Authentication
- **No public registration**: Registration page removed, admin-only user creation
- **Landing page**: Redirects directly to login
- **Login method**: Username-based authentication (not email)
- **Admin users**: 
  - Username: `spyros.l` - Email: spyros.l@itpal.com
  - Username: `manolis.p` - Email: manolis.p@itpal.com
  - Username: `nicolas.ch` - Email: nicolas.ch@itpal.com
  - Default password: `123` (bcrypt hashed)

### Password Management
- **Hashing**: bcrypt with cost factor 12
- **Manual password changes**: See `PASSWORD_MANAGEMENT.md` for instructions
- Current hash for password "123": `$2b$12$eGwnuOjqgo9DaQR2zAVFSe7Xl8UETyHshemaeG9bEhjRL.FRRRakq`

## System Architecture
### UI/UX Decisions
The frontend utilizes Bootstrap 5.3.0 and Bootstrap Icons 1.10.0 for a modern, responsive user interface. Key UI/UX elements include:
- Clean, modern design with gradient styling.
- Responsive layout using the Bootstrap grid system.
- Bootstrap modals for creation and editing forms.
- Dynamic line item management within forms.
- Status badges for visual clarity of invoice/quote status.
- Dashboard with key statistics and analytics.
- PDF preview modal after generation.
- Email composition modal with editable subject/body.
- All system messages (confirmations, errors, success) are handled via Bootstrap modals and toast notifications for a consistent user experience.

### Technical Implementations
- **Backend Framework**: FastAPI 0.109.0.
- **Database**: PostgreSQL with SQLAlchemy 2.0.25 ORM.
- **Authentication**: JWT tokens with bcrypt password hashing for secure user sessions and role-based access control.
- **PDF Generation**: ReportLab 4.0.9 for professional document creation with dynamic content and layout.
- **Object Storage**: S3-compatible storage (boto3) for PDFs, with fallback to local storage.
- **Email Notifications**: Brevo API (sib-api-v3-sdk) for sending invoices/quotes.
- **Frontend**: Vanilla HTML/CSS/JavaScript (ES6+) with Fetch API.
- **Currency**: All financial values are handled in Euros (€).
- **Discount System**: Supports either overall document discount or per-line-item discounts, affecting subtotal, tax, and total calculations.
- **Contact Fields**: Enhanced contact fields for clients, including optional company name, email, and two telephone numbers with Cyprus-specific validation. Client Reg. No. and Client T.I.C. are also supported.
- **PDF Layout**: Standardized professional PDF footer with company contact information and dynamic "Bill To" sections that only display filled fields.
- **Draft Functionality**: Users can save invoices/quotes as drafts or finalize them. New documents are created as drafts by default.
- **Search**: Real-time, case-insensitive search functionality for invoices and quotes across multiple fields.
- **Customer Management**: Comprehensive module for managing customers with CRUD operations, real-time search, and auto-sync with invoice/quote creation/editing based on telephone number.
- **Analytics Dashboard**: Provides comprehensive financial visualizations using Chart.js, including total revenue, draft amounts, month-over-month, year-over-year comparisons, and various charts for historical data analysis.
- **Quote Status**: Quotes can have 'Draft', 'Issued', 'Invoiced', or 'Cancelled' statuses. "Convert to Invoice" functionality transfers all quote fields and updates customer data, changing the quote status to "Invoiced".
- **Document Integrity**: Issued documents cannot be edited or deleted - they must be cancelled instead with a mandatory reason. Cancelled documents are preserved for audit purposes with grey styling and disabled actions.
- **Customer Snapshot**: When documents are issued, customer details are captured and frozen at that moment for historical accuracy.
- **Audit Trail**: Documents track issued_at/issued_by and cancelled_at/cancelled_by/cancel_reason metadata.

### Feature Specifications
- **Authentication & Authorization**: Admin-only user registration, JWT login, role-based access, protected routes, bcrypt hashing.
- **Invoice Management**: CRUD operations, PDF generation, email sending, automatic numbering, status management (draft/issued/cancelled), document locking for issued documents.
- **Quote Management**: CRUD operations, PDF generation, email sending, automatic numbering, conversion to invoice, status management (draft/issued/invoiced/cancelled), document locking for issued documents.
- **Customer Management**: Full CRUD, search, and active/inactive status toggle with auto-sync during invoice/quote creation/editing.
- **Data Model**: Clearly defined models for Users, Invoices, Invoice Line Items, Quotes, Quote Line Items, and Customers with appropriate relationships.

## External Dependencies
- **Database**: PostgreSQL
- **Email Service**: Brevo API (`sib-api-v3-sdk`)
- **Object Storage**: S3-compatible service (`boto3`)
- **Frontend Library**: Bootstrap 5.3.0
- **Icon Library**: Bootstrap Icons 1.10.0
- **PDF Generation Library**: ReportLab 4.0.9
- **Charting Library**: Chart.js