# Invoice & Quote Management System

## Overview
This project is a full-stack invoice and quote management system designed to streamline business operations for I.T. PAL Technology Solutions Ltd. It provides functionalities for creating, managing, and sending professional invoices and quotes. The system includes user authentication, role-based access, PDF generation, and email notifications. The goal is to enhance efficiency in financial documentation and client communication.

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
- Dashboard with key statistics.
- PDF preview modal after generation.
- Email composition modal with editable subject/body.

### Technical Implementations
- **Backend Framework**: FastAPI 0.109.0 for high performance.
- **Database**: PostgreSQL with SQLAlchemy 2.0.25 ORM.
- **Authentication**: JWT tokens with bcrypt password hashing for secure user sessions and role-based access control (admin/user).
- **PDF Generation**: ReportLab 4.0.9 for professional document creation.
- **Object Storage**: S3-compatible storage (boto3) for PDFs, with fallback to local storage.
- **Email Notifications**: Brevo API (sib-api-v3-sdk) for sending invoices/quotes.
- **Frontend**: Vanilla HTML/CSS/JavaScript (ES6+) with Fetch API for API interactions.
- **Currency**: All financial values are handled in Euros (€).
- **Discount System**: Comprehensive discount system supporting either overall document discount or per-line-item discounts, affecting subtotal, tax, and total calculations.
- **Contact Fields**: Enhanced contact fields for clients, including optional company name, email, and two telephone numbers with Cyprus-specific validation.
- **PDF Layout**: Standardized professional PDF footer with company contact information.
- **Draft Functionality**: Users can save invoices/quotes as drafts or finalize them, with full editing capability for drafts.
- **Search**: Real-time, case-insensitive search functionality for invoices across multiple fields.

### Feature Specifications
- **Authentication & Authorization**: User registration (admin-only), JWT login, role-based access, protected routes, bcrypt hashing.
- **Invoice Management**: CRUD operations, PDF generation, email sending, automatic numbering, status management (draft/issued).
- **Quote Management**: CRUD operations, PDF generation, email sending, automatic numbering, conversion to invoice, status management.
- **Data Model**: Clearly defined models for Users, Invoices, Invoice Line Items, Quotes, and Quote Line Items, with appropriate relationships.

## External Dependencies

- **Database**: PostgreSQL (via Replit integration)
- **Email Service**: Brevo API (`sib-api-v3-sdk`)
- **Object Storage**: S3-compatible service (`boto3`)
- **Frontend Library**: Bootstrap 5.3.0
- **Icon Library**: Bootstrap Icons 1.10.0
- **PDF Generation Library**: ReportLab 4.0.9

## Recent Changes

**November 21, 2025 - Final Production Configuration**
- **Database cleanup**: Cleared all test invoices and customers for fresh start
- **PDF footer updates**:
  - Removed company address (Pera Kampou 6, Kato Polemidia, Limassol, 4170)
  - Added bank details: IBAN: LT41 3250 0726 5105 4093 | BIC: REVOLT21 | BANK: Revolut Bank UAB
  - Changed "Web: itpalsolutions.com" to "Website: www.itpalsolutions.com"
- **TAX changed to VAT**:
  - Updated all forms (invoice and quote creation) to display "VAT (%)" instead of "Tax (%)"
  - Updated all PDFs to show "VAT" instead of "Tax"
  - Backend tax field name remains the same for database compatibility
- **Flexible client identification**:
  - Client Name is now optional (was required)
  - System requires either Client Name OR Company Name (at least one must be provided)
  - Both fields can be filled if desired
  - Backend validation ensures at least one is present

**November 21, 2025 - Customer Management System & Auto-Sync**
- Implemented complete customer management module:
  - Customer model with all fields (name, company, email, telephone1/2, address, reg_no, tax_id, is_active)
  - Full CRUD API with real-time search by name, company, email, or telephone
  - Customer page with responsive table, add/edit modals, toggle active/inactive status
  - Telephone1 is unique identifier for customers
- Auto-sync customer data with invoices:
  - Creating invoice: automatically creates customer if telephone1 doesn't exist
  - Editing invoice: automatically updates customer details if telephone1 exists
  - Telephone1 now required for invoices (used to match/create customers)
- Navigation enhancement:
  - Added "Customers" navigation link to all pages (dashboard, invoices, quotes)
- Database cleanup:
  - Cleared all test invoices to start sequential real invoice numbering (INV-00001+)

**November 21, 2025 - Enhanced Customer Fields & Dynamic PDF Layout**
- Added optional customer information fields:
  - Client Reg. No. (Registration Number) - optional field
  - Client T.I.C. (Tax Identification Code) - optional field
  - Both fields stored in database and displayed in PDFs when provided
- Implemented dynamic PDF Bill To section:
  - Only shows filled/completed fields (no empty/null fields displayed)
  - Intelligent two-column layout that balances fields automatically
  - Saves vertical space to prevent multi-page invoices
  - Includes all customer fields: name, company, email, telephones, reg no, tax ID, address
- Enhanced line items handling:
  - Changed description input from text field to textarea (2 rows)
  - Added field labels to all line item inputs (Description, Quantity, Unit Price, Discount %)
  - PDF descriptions now wrap properly with auto row height adjustment
  - HTML special characters in descriptions are escaped to prevent rendering errors
  - Line item table uses proper column widths to prevent overflow
- Security improvements:
  - HTML escaping prevents ReportLab parsing errors with special characters (<, >, &)
  - Prevents potential XSS vulnerabilities in PDF generation

**November 21, 2025 - Professional PDF Footer**
- Updated PDF footer with official company information:
  - Company Name: IT PAL TECHNOLOGY SOLUTIONS LTD (bold, teal color)
  - Address: Pera Kampou 6, Kato Polemidia, Limassol, 4170
  - Registration details: Reg. No.: HE482919 / T.I.C: 60254066D
  - Contact: Tel: +357-97652017, Email: finance@itpalsolutions.com, Web: itpalsolutions.com
  - Design: Teal separator line above footer, centered text layout with organized multi-line structure
  - Applied to both invoice and quote PDFs for consistency

**November 17, 2025 - PDF Labels, Due Date Removal & Manual Invoice Issuing**
- Enhanced PDF Bill To section with field labels:
  - Added labels: "Client Name:", "Tel:", "Tel 2:", "Company Name:", "Email:", "Address:"
  - Applied to both invoice and quote PDFs using two-column layout
- Removed due date functionality:
  - Removed due_date field from invoice creation/edit forms
  - Removed due_date column from invoices table
  - Removed due_date from email templates
  - Backend maintains optional due_date field in database for future use
- Implemented manual invoice issuing workflow:
  - Added "Mark as Issued" button in invoices table for draft invoices
  - Added "Mark as Issued" button in edit modal (only visible when editing drafts)
  - Button shows confirmation dialog before changing status
  - Removed automatic status change when sending emails
  - Users must manually mark invoices as issued using dedicated buttons
- PDF regeneration improvements:
  - PDFs automatically regenerate after editing (pdf_url cleared on update)
  - Changes to fields like telephone 2 deletion now properly reflect in regenerated PDFs

**November 17, 2025 - Discount System, Status Simplification & Search Functionality**
- Simplified invoice/quote status system:
  - Changed from "draft, sent, paid, overdue" to only "draft" and "issued"
  - "issued" represents finalized invoices/quotes
  - Backend, frontend, and email endpoints updated to use new status values
- Implemented comprehensive discount system:
  - Added overall discount field (percentage 0-100%) to invoices/quotes
  - Added line item discount field (percentage 0-100%) to each line item
  - Discounts are mutually exclusive: use either overall discount OR line item discounts
  - Backend calculation flow: Line items → Subtotal → Overall Discount → Tax → Total
  - PDF displays discount column in line items table if any item has discount > 0
  - PDF displays overall discount in totals section if discount > 0
- Enhanced invoice PDF layout:
  - PDF title dynamically shows "INVOICE DRAFT" for draft status, "INVOICE" for issued status
  - Removed status badge from PDF (status only indicated by title)
  - Info table simplified to show only Invoice Number and Issue Date
  - Bill To section restructured with two-column layout
- Frontend enhancements:
  - Added Telephone column to invoices table (displays telephone 1)
  - Implemented real-time search functionality for invoices
  - Overall discount field added to invoice/quote forms with validation
  - Line item discount column added with validation