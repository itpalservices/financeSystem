from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from datetime import datetime
import os
import boto3
from sqlalchemy.orm import Session
import html

from app.config import settings

def upload_to_s3(file_path: str, object_name: str) -> str:
    bucket_id = settings.object_storage_bucket
    if not bucket_id:
        return f"/pdfs/{object_name}"
    
    try:
        s3_client = boto3.client('s3')
        s3_client.upload_file(file_path, bucket_id, object_name)
        return f"https://{bucket_id}.s3.amazonaws.com/{object_name}"
    except Exception as e:
        print(f"Error uploading to S3: {e}")
        return f"/pdfs/{object_name}"

def generate_invoice_pdf(invoice, db: Session) -> str:
    os.makedirs("pdfs", exist_ok=True)
    filename = f"invoice_{invoice.invoice_number}.pdf"
    filepath = os.path.join("pdfs", filename)
    
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    logo_path = "static/logo.png"
    if os.path.exists(logo_path):
        logo = Image(logo_path, width=2.5*inch, height=0.9*inch)
        elements.append(logo)
        elements.append(Spacer(1, 0.2*inch))
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1b7ca8'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    # Change title based on status
    if invoice.status.value == "draft":
        title_text = "INVOICE DRAFT"
        elements.append(Paragraph(title_text, title_style))
    elif invoice.status.value == "cancelled" and invoice.cancelled_at is not None:
        # Use red title for cancelled invoices (with verified metadata)
        cancelled_title_style = ParagraphStyle(
            'CancelledTitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.red,
            spaceAfter=30,
            alignment=TA_CENTER
        )
        elements.append(Paragraph("CANCELLED INVOICE", cancelled_title_style))
    else:
        title_text = "INVOICE"
        elements.append(Paragraph(title_text, title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Remove status from PDF, only show Invoice Number and Issue Date
    info_data = [
        ["Invoice Number:", invoice.invoice_number, "Issue Date:", invoice.issue_date.strftime("%d-%m-%Y")]
    ]
    
    info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Build dynamic Bill To section - only show filled fields
    bill_to_fields = []
    
    # Always include client name (mandatory)
    bill_to_fields.append(f"Client Name: {invoice.client_name}")
    
    # Add optional fields only if they have values
    if invoice.company_name:
        bill_to_fields.append(f"Company Name: {invoice.company_name}")
    if invoice.client_email:
        bill_to_fields.append(f"Email: {invoice.client_email}")
    if invoice.telephone1:
        bill_to_fields.append(f"Tel: {invoice.telephone1}")
    if invoice.telephone2:
        bill_to_fields.append(f"Tel 2: {invoice.telephone2}")
    if invoice.client_reg_no:
        bill_to_fields.append(f"Reg. No.: {invoice.client_reg_no}")
    if invoice.client_tax_id:
        bill_to_fields.append(f"T.I.C.: {invoice.client_tax_id}")
    if invoice.client_address:
        bill_to_fields.append(f"Address: {invoice.client_address}")
    
    # Distribute fields across two columns for better space utilization
    mid_point = (len(bill_to_fields) + 1) // 2
    left_column = bill_to_fields[:mid_point]
    right_column = bill_to_fields[mid_point:]
    
    # Create two-column table for Bill To
    bill_to_data = [["Bill To:", ""]]
    max_rows = max(len(left_column), len(right_column))
    for i in range(max_rows):
        left_text = left_column[i] if i < len(left_column) else ""
        right_text = right_column[i] if i < len(right_column) else ""
        bill_to_data.append([left_text, right_text])
    
    client_table = Table(bill_to_data, colWidths=[3.5*inch, 3.5*inch])
    client_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(client_table)
    elements.append(Spacer(1, 0.2*inch))
    
    # Check if any line item has a discount
    has_line_item_discount = any(item.discount > 0 for item in invoice.line_items)
    
    # Create a paragraph style for description wrapping
    desc_style = ParagraphStyle(
        'DescriptionStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        wordWrap='CJK'
    )
    
    if has_line_item_discount:
        line_items_data = [["Description", "Quantity", "Unit Price", "Discount %", "Total"]]
        for item in invoice.line_items:
            # Escape HTML special characters to prevent ReportLab parsing errors
            safe_description = html.escape(item.description)
            line_items_data.append([
                Paragraph(safe_description, desc_style),
                str(int(item.quantity)),
                f"€{item.unit_price:.2f}",
                f"{item.discount}%" if item.discount > 0 else "-",
                f"€{item.total:.2f}"
            ])
        line_items_table = Table(line_items_data, colWidths=[3*inch, 0.8*inch, 1.1*inch, 0.9*inch, 1.2*inch])
    else:
        line_items_data = [["Description", "Quantity", "Unit Price", "Total"]]
        for item in invoice.line_items:
            # Escape HTML special characters to prevent ReportLab parsing errors
            safe_description = html.escape(item.description)
            line_items_data.append([
                Paragraph(safe_description, desc_style),
                str(int(item.quantity)),
                f"€{item.unit_price:.2f}",
                f"€{item.total:.2f}"
            ])
        line_items_table = Table(line_items_data, colWidths=[4*inch, 0.9*inch, 1.2*inch, 1.4*inch])
    line_items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1b7ca8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    
    elements.append(line_items_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Build totals section with discount support
    totals_data = [["Subtotal:", f"€{invoice.subtotal:.2f}"]]
    
    # Add discount if present (overall discount only)
    if invoice.discount > 0:
        discount_amount = invoice.subtotal * (invoice.discount / 100)
        subtotal_after_discount = invoice.subtotal - discount_amount
        totals_data.append([f"Discount ({invoice.discount}%):", f"-€{discount_amount:.2f}"])
    else:
        subtotal_after_discount = invoice.subtotal
    
    # Calculate VAT amount from percentage
    vat_percentage = invoice.tax or 0.0
    vat_amount = subtotal_after_discount * (vat_percentage / 100)
    totals_data.append([f"VAT ({vat_percentage}%):", f"€{vat_amount:.2f}"])
    
    # Total
    total = subtotal_after_discount + vat_amount
    totals_data.append(["Total:", f"€{total:.2f}"])
    
    totals_table = Table(totals_data, colWidths=[5.5*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    elements.append(totals_table)
    
    if invoice.notes:
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph(f"<b>Notes:</b> {invoice.notes}", styles['Normal']))
    
    # Add footer with separator line
    elements.append(Spacer(1, 0.5*inch))
    
    # Footer separator line
    footer_line_data = [["" for _ in range(1)]]
    footer_line_table = Table(footer_line_data, colWidths=[7*inch])
    footer_line_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#1b7ca8')),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(footer_line_table)
    
    # Footer styles
    footer_company_style = ParagraphStyle(
        'FooterCompany',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#1b7ca8'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    footer_info_style = ParagraphStyle(
        'FooterInfo',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#555555'),
        alignment=TA_CENTER,
        leading=12
    )
    
    # Company name
    elements.append(Paragraph("IT PAL TECHNOLOGY SOLUTIONS LTD", footer_company_style))
    elements.append(Spacer(1, 0.05*inch))
    
    # Company details in organized lines
    footer_line1 = "Reg. No.: HE482919 / T.I.C: 60254066D"
    footer_line2 = "IBAN: LT41 3250 0726 5105 4093 &nbsp;&nbsp;|&nbsp;&nbsp; BIC: REVOLT21 &nbsp;&nbsp;|&nbsp;&nbsp; BANK: Revolut Bank UAB"
    footer_line3 = "Tel: +357-97652017 &nbsp;&nbsp;|&nbsp;&nbsp; Email: finance@itpalsolutions.com &nbsp;&nbsp;|&nbsp;&nbsp; Website: www.itpalsolutions.com"
    
    elements.append(Paragraph(footer_line1, footer_info_style))
    elements.append(Paragraph(footer_line2, footer_info_style))
    elements.append(Paragraph(footer_line3, footer_info_style))
    
    doc.build(elements)
    
    pdf_url = upload_to_s3(filepath, filename)
    
    return pdf_url

def generate_quote_pdf(quote, db: Session) -> str:
    os.makedirs("pdfs", exist_ok=True)
    filename = f"quote_{quote.quote_number}.pdf"
    filepath = os.path.join("pdfs", filename)
    
    doc = SimpleDocTemplate(filepath, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    logo_path = "static/logo.png"
    if os.path.exists(logo_path):
        logo = Image(logo_path, width=2.5*inch, height=0.9*inch)
        elements.append(logo)
        elements.append(Spacer(1, 0.2*inch))
    
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1b7ca8'),
        spaceAfter=30,
        alignment=TA_CENTER
    )
    
    # Change title based on status
    if quote.status.value == "draft":
        title_text = "QUOTATION DRAFT"
        elements.append(Paragraph(title_text, title_style))
    elif quote.status.value == "cancelled" and quote.cancelled_at is not None:
        # Use red title for cancelled quotes (with verified metadata)
        cancelled_title_style = ParagraphStyle(
            'CancelledTitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.red,
            spaceAfter=30,
            alignment=TA_CENTER
        )
        elements.append(Paragraph("CANCELLED QUOTATION", cancelled_title_style))
    else:
        title_text = "QUOTATION"
        elements.append(Paragraph(title_text, title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    info_data = [
        ["Quote Number:", quote.quote_number, "Issue Date:", quote.issue_date.strftime("%d-%m-%Y")],
        ["", "", "Valid Until:", quote.valid_until.strftime("%d-%m-%Y")]
    ]
    
    info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Build Quote For section with two columns - only show filled fields
    # Left column: Client name, Tel 1, Tel 2
    left_column = []
    if quote.client_name:
        left_column.append(f"Client Name: {html.escape(quote.client_name)}")
    if quote.telephone1:
        left_column.append(f"Tel: {quote.telephone1}")
    if quote.telephone2:
        left_column.append(f"Tel 2: {quote.telephone2}")
    
    # Right column: Company name, Email, Address
    right_column = []
    if quote.company_name:
        right_column.append(f"Company Name: {html.escape(quote.company_name)}")
    if quote.client_email:
        right_column.append(f"Email: {quote.client_email}")
    if quote.client_address:
        right_column.append(f"Address: {html.escape(quote.client_address)}")
    
    # Create two-column table for Quote For
    quote_for_data = [["Quote For:", ""]]
    max_rows = max(len(left_column), len(right_column))
    for i in range(max_rows):
        left_text = left_column[i] if i < len(left_column) else ""
        right_text = right_column[i] if i < len(right_column) else ""
        quote_for_data.append([left_text, right_text])
    
    client_table = Table(quote_for_data, colWidths=[3.5*inch, 3.5*inch])
    client_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(client_table)
    elements.append(Spacer(1, 0.3*inch))
    
    line_items_data = [["Description", "Quantity", "Unit Price", "Total"]]
    
    for item in quote.line_items:
        line_items_data.append([
            item.description,
            str(int(item.quantity)),
            f"€{item.unit_price:.2f}",
            f"€{item.total:.2f}"
        ])
    
    line_items_table = Table(line_items_data, colWidths=[3.5*inch, 1*inch, 1.5*inch, 1.5*inch])
    line_items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1b7ca8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    
    elements.append(line_items_table)
    elements.append(Spacer(1, 0.3*inch))
    
    totals_data = [
        ["Subtotal:", f"€{quote.subtotal:.2f}"],
        ["VAT:", f"€{quote.tax:.2f}"],
        ["Total:", f"€{quote.total:.2f}"]
    ]
    
    totals_table = Table(totals_data, colWidths=[5.5*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    
    elements.append(totals_table)
    
    if quote.notes:
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph(f"<b>Notes:</b> {quote.notes}", styles['Normal']))
    
    # Add footer with separator line
    elements.append(Spacer(1, 0.5*inch))
    
    # Footer separator line
    footer_line_data = [["" for _ in range(1)]]
    footer_line_table = Table(footer_line_data, colWidths=[7*inch])
    footer_line_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#1b7ca8')),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(footer_line_table)
    
    # Footer styles
    footer_company_style = ParagraphStyle(
        'FooterCompany',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#1b7ca8'),
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    footer_info_style = ParagraphStyle(
        'FooterInfo',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#555555'),
        alignment=TA_CENTER,
        leading=12
    )
    
    # Company name
    elements.append(Paragraph("IT PAL TECHNOLOGY SOLUTIONS LTD", footer_company_style))
    elements.append(Spacer(1, 0.05*inch))
    
    # Company details in organized lines
    footer_line1 = "Reg. No.: HE482919 / T.I.C: 60254066D"
    footer_line2 = "IBAN: LT41 3250 0726 5105 4093 &nbsp;&nbsp;|&nbsp;&nbsp; BIC: REVOLT21 &nbsp;&nbsp;|&nbsp;&nbsp; BANK: Revolut Bank UAB"
    footer_line3 = "Tel: +357-97652017 &nbsp;&nbsp;|&nbsp;&nbsp; Email: finance@itpalsolutions.com &nbsp;&nbsp;|&nbsp;&nbsp; Website: www.itpalsolutions.com"
    
    elements.append(Paragraph(footer_line1, footer_info_style))
    elements.append(Paragraph(footer_line2, footer_info_style))
    elements.append(Paragraph(footer_line3, footer_info_style))
    
    doc.build(elements)
    
    pdf_url = upload_to_s3(filepath, filename)
    
    return pdf_url
