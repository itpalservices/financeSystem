# Invoice & Quote Management System

## Overview
A full-stack invoice and quote management system built with FastAPI (Python) backend and vanilla HTML/CSS/JavaScript frontend. The system includes user authentication, role-based access control, PDF generation, S3-compatible object storage, and email notifications via Brevo API.

## Current State
- **Status**: MVP Complete with Bootstrap 5 UI
- **Last Updated**: November 17, 2025
- **Version**: 1.1.0

## Tech Stack

### Backend
- **Framework**: FastAPI 0.109.0
- **Database**: PostgreSQL (via Replit integration)
- **ORM**: SQLAlchemy 2.0.25
- **Authentication**: JWT tokens with bcrypt password hashing
- **PDF Generation**: ReportLab 4.0.9
- **Email**: Brevo API (sib-api-v3-sdk)
- **Storage**: S3-compatible object storage (boto3)

### Frontend
- **Bootstrap 5.3.0** - Modern responsive UI framework
- **Bootstrap Icons 1.10.0** - Icon library for UI elements
- **Vanilla JavaScript** (ES6+) with Bootstrap modals
- **Responsive CSS** with Bootstrap grid system
- **Fetch API** for HTTP requests

## Project Architecture

### Directory Structure
```
root/
├── app/
│   ├── models/
│   │   ├── user.py          # User model with role-based access
│   │   ├── invoice.py       # Invoice and InvoiceLineItem models
│   │   └── quote.py         # Quote and QuoteLineItem models
│   ├── routes/
│   │   ├── auth.py          # Registration and login endpoints
│   │   ├── users.py         # User profile endpoints
│   │   ├── invoices.py      # Invoice CRUD and email/PDF endpoints
│   │   └── quotes.py        # Quote CRUD, conversion, and email/PDF endpoints
│   ├── utils/
│   │   ├── pdf_generator.py # PDF generation with ReportLab
│   │   └── email_sender.py  # Email sending via Brevo
│   ├── database.py          # Database connection and session
│   ├── config.py            # Configuration settings
│   ├── auth.py              # JWT and password utilities
│   └── schemas.py           # Pydantic models for validation
├── static/
│   ├── css/
│   │   └── styles.css       # Global styles
│   ├── js/
│   │   ├── api.js           # API client and auth utilities
│   │   ├── invoices.js      # Invoice management logic
│   │   └── quotes.js        # Quote management logic
│   ├── index.html           # Landing page
│   ├── login.html           # Login page
│   ├── register.html        # Registration page
│   ├── dashboard.html       # Dashboard with stats
│   ├── invoices.html        # Invoice management page
│   └── quotes.html          # Quote management page
├── main.py                  # FastAPI application entry point
├── requirements.txt         # Python dependencies
└── .gitignore              # Git ignore rules
```

## Database Schema

### Users
- `id`: Primary key
- `email`: Unique email address
- `hashed_password`: Bcrypt hashed password
- `role`: User role (admin/user)
- `created_at`: Timestamp

### Invoices
- `id`: Primary key
- `invoice_number`: Unique identifier (INV-XXXXX)
- `user_id`: Foreign key to users
- `client_name`, `client_email`, `client_address`: Client information
- `status`: Enum (draft, sent, paid, overdue)
- `issue_date`, `due_date`: Dates
- `subtotal`, `tax`, `total`: Financial amounts
- `notes`: Optional notes
- `pdf_url`: Generated PDF location
- `created_at`, `updated_at`: Timestamps

### Invoice Line Items
- `id`: Primary key
- `invoice_id`: Foreign key to invoices
- `description`: Item description
- `quantity`, `unit_price`, `total`: Amounts

### Quotes
- Similar structure to invoices with:
- `quote_number`: Unique identifier (QUO-XXXXX)
- `valid_until`: Quote expiration date
- `converted_to_invoice_id`: Link to converted invoice

### Quote Line Items
- Similar structure to invoice line items

## MVP Features

### Authentication & Authorization
- ✅ User registration with email and password
- ✅ JWT-based login system
- ✅ Role-based access control (admin/user)
- ✅ Password hashing with bcrypt
- ✅ Protected routes requiring authentication

### Invoice Management
- ✅ Create invoices with line items
- ✅ View all invoices (filtered by user role)
- ✅ Update invoice details and status
- ✅ Delete invoices
- ✅ Generate PDF documents
- ✅ Send invoices via email (Brevo)
- ✅ Automatic invoice numbering

### Quote Management
- ✅ Create quotes with line items
- ✅ View all quotes (filtered by user role)
- ✅ Update quote details and status
- ✅ Delete quotes
- ✅ Convert quotes to invoices
- ✅ Generate PDF documents
- ✅ Send quotes via email (Brevo)
- ✅ Automatic quote numbering

### PDF Generation
- ✅ Professional invoice PDFs
- ✅ Professional quote PDFs
- ✅ S3-compatible storage integration
- ✅ Fallback to local storage if S3 not configured

### User Interface
- ✅ Mobile-responsive design
- ✅ Clean, modern UI with gradient styling
- ✅ Dashboard with statistics
- ✅ Modal-based forms for creating invoices/quotes
- ✅ Dynamic line item management
- ✅ Status badges for visual clarity

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Users
- `GET /api/users/me` - Get current user info

### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/{id}` - Get invoice details
- `PUT /api/invoices/{id}` - Update invoice
- `DELETE /api/invoices/{id}` - Delete invoice
- `POST /api/invoices/{id}/generate-pdf` - Generate PDF
- `POST /api/invoices/{id}/send-email` - Send via email

### Quotes
- `GET /api/quotes` - List all quotes
- `POST /api/quotes` - Create new quote
- `GET /api/quotes/{id}` - Get quote details
- `PUT /api/quotes/{id}` - Update quote
- `DELETE /api/quotes/{id}` - Delete quote
- `POST /api/quotes/{id}/convert-to-invoice` - Convert to invoice
- `POST /api/quotes/{id}/generate-pdf` - Generate PDF
- `POST /api/quotes/{id}/send-email` - Send via email

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)

### Optional
- `SECRET_KEY` - JWT signing key (defaults to development key)
- `BREVO_API_KEY` - Brevo API key for email sending
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - S3 bucket for PDF storage

## Running the Application

The application runs automatically via the configured workflow:
```bash
python main.py
```

The FastAPI server starts on `http://0.0.0.0:5000` and is accessible through the Replit webview.

## Next Phase Features

1. **Payment Tracking**
   - Payment status management
   - Payment history tracking
   - Overdue invoice notifications

2. **Recurring Invoices**
   - Automated invoice scheduling
   - Recurring invoice templates
   - Automated email reminders

3. **Client Management**
   - Dedicated client database
   - Client history tracking
   - Client-specific pricing

4. **Reporting & Analytics**
   - Revenue analytics
   - Invoice aging reports
   - Payment trend analysis

5. **Advanced Features**
   - Invoice templates
   - Multi-currency support
   - Tax calculation automation
   - Expense tracking

## Security Considerations

- ✅ Passwords hashed with bcrypt
- ✅ JWT tokens for stateless authentication
- ✅ Role-based access control
- ✅ Input validation with Pydantic
- ✅ SQL injection prevention via SQLAlchemy ORM
- ✅ CORS configured for API access

## Known Limitations

1. **Email Configuration**: Requires Brevo API key to be configured for email sending
2. **S3 Storage**: Falls back to local storage if S3 credentials not configured
3. **No Password Reset**: Implement password reset via email in next phase
4. **No Multi-tenancy**: Current design is single-organization
5. **No File Attachments**: Support for attaching additional documents to invoices/quotes

## Recent Changes

**November 17, 2025 - PDF Footer, Telephone Validation & Regeneration**
- Added professional PDF footer with company contact information:
  - Website: itpalsolutions.com (🌐 icon)
  - Email: info@itpalsolutions.com (✉ icon)
  - VAT Reg No.: CY111111 (📄 icon)
  - Footer appears on all invoice and quote PDFs
- Implemented telephone number validation (Cyprus format):
  - Must be exactly 8 characters
  - Must start with: 25, 22, 24, 23, 99, 95, 94, 96, or 97
  - HTML5 pattern validation with helpful error messages
  - Applies to both create and edit modals for invoices and quotes
- Enhanced PDF regeneration workflow:
  - Backend now clears pdf_url when updating invoices or quotes
  - Generate PDF button automatically reappears after editing
  - Users can regenerate PDFs with updated details after any changes
- Backend improvements:
  - Added support for company_name, telephone1, telephone2 in update routes
  - All contact fields properly handled in both invoices and quotes

**November 17, 2025 - PDF Enhancements & Draft Invoice Editing**
- Adjusted PDF logo height to 0.9 inches for optimal branding display
- Quantity now displays as integer (without decimals) in PDF documents
- Date format changed to DD-MM-YYYY (e.g., 17-11-2025) in PDFs, tables, and emails
- Implemented full edit functionality for draft invoices:
  - Edit button (pencil icon) appears only for draft invoices
  - Modal populates with existing invoice data when editing
  - Proper state management prevents data leakage between create/edit operations
  - Line items properly reset after editing
  - Updated invoices maintain draft or finalized status
- Telephone 1 and Telephone 2 display correctly in "Bill To" section of PDFs

**November 17, 2025 - Euro Currency & Enhanced Contact Fields**
- Changed all currency from USD ($) to Euro (€) throughout the application
- Updated invoice/quote forms with enhanced contact information:
  - Client Name (mandatory)
  - Company Name (optional)
  - Client Email (optional - changed from mandatory)
  - Telephone 1 (mandatory)
  - Telephone 2 (optional)
- Updated database models to support new fields
- Modified PDF generation to display all contact fields
- Changed Cancel button to red (danger) styling per user request
- Updated email templates to use Euro currency
- Maintained "Save as Draft" and "Create & Finalize" workflow

**November 17, 2025 - Bootstrap 5 UI Update**
- Integrated Bootstrap 5.3.0 and Bootstrap Icons 1.10.0 across all pages
- Redesigned login page with gradient background and card layout
- Modernized dashboard with stat cards and responsive navbar
- Implemented Bootstrap modals for invoice/quote creation
- Added draft status support - users can save as draft or create & finalize
- Created PDF preview modal after generation with view/download options
- Built email composition modal with editable subject/body and PDF preview
- Updated all tables with Bootstrap styling and action button groups
- Improved mobile responsiveness with Bootstrap grid system
- Enhanced UX with status badges, icons, and modern button styling

**November 17, 2025 - Initial MVP**
- Complete backend with FastAPI
- Full frontend with vanilla HTML/CSS/JS
- Database schema with all models
- PDF generation and email integration
- S3 storage integration with fallback
- Role-based access control
- Username-based authentication

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
