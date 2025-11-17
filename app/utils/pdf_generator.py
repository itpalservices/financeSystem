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
    title_text = "INVOICE DRAFT" if invoice.status.value == "draft" else "INVOICE"
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
    
    # Build Bill To section with two columns
    # Left column: Client name, Tel 1, Tel 2
    left_column = [f"Client Name: {invoice.client_name}"]
    if invoice.telephone1:
        left_column.append(f"Tel: {invoice.telephone1}")
    if invoice.telephone2:
        left_column.append(f"Tel 2: {invoice.telephone2}")
    
    # Right column: Company name, Email, Address
    right_column = []
    if invoice.company_name:
        right_column.append(f"Company Name: {invoice.company_name}")
    if invoice.client_email:
        right_column.append(f"Email: {invoice.client_email}")
    if invoice.client_address:
        right_column.append(f"Address: {invoice.client_address}")
    
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
    elements.append(Spacer(1, 0.3*inch))
    
    # Check if any line item has a discount
    has_line_item_discount = any(item.discount > 0 for item in invoice.line_items)
    
    if has_line_item_discount:
        line_items_data = [["Description", "Quantity", "Unit Price", "Discount %", "Total"]]
        for item in invoice.line_items:
            line_items_data.append([
                item.description,
                str(int(item.quantity)),
                f"€{item.unit_price:.2f}",
                f"{item.discount}%" if item.discount > 0 else "-",
                f"€{item.total:.2f}"
            ])
        line_items_table = Table(line_items_data, colWidths=[2.5*inch, 0.8*inch, 1.2*inch, 1*inch, 1.5*inch])
    else:
        line_items_data = [["Description", "Quantity", "Unit Price", "Total"]]
        for item in invoice.line_items:
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
    
    # Build totals section with discount support
    totals_data = [["Subtotal:", f"€{invoice.subtotal:.2f}"]]
    
    # Add discount if present (overall discount only)
    if invoice.discount > 0:
        discount_amount = invoice.subtotal * (invoice.discount / 100)
        subtotal_after_discount = invoice.subtotal - discount_amount
        totals_data.append([f"Discount ({invoice.discount}%):", f"-€{discount_amount:.2f}"])
    else:
        subtotal_after_discount = invoice.subtotal
    
    # Calculate tax amount from percentage
    tax_percentage = invoice.tax or 0.0
    tax_amount = subtotal_after_discount * (tax_percentage / 100)
    totals_data.append([f"Tax ({tax_percentage}%):", f"€{tax_amount:.2f}"])
    
    # Total
    total = subtotal_after_discount + tax_amount
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
    
    # Add footer
    elements.append(Spacer(1, 0.5*inch))
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER
    )
    
    footer_text = """
    <b>🌐 Website:</b> itpalsolutions.com &nbsp;&nbsp;|&nbsp;&nbsp; 
    <b>✉ Email:</b> info@itpalsolutions.com &nbsp;&nbsp;|&nbsp;&nbsp; 
    <b>📄 VAT Reg No.:</b> CY111111
    """
    
    elements.append(Paragraph(footer_text, footer_style))
    
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
    
    elements.append(Paragraph("QUOTE", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    info_data = [
        ["Quote Number:", quote.quote_number, "Issue Date:", quote.issue_date.strftime("%d-%m-%Y")],
        ["Status:", quote.status.value.upper(), "Valid Until:", quote.valid_until.strftime("%d-%m-%Y")]
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
    
    # Build Quote For section with two columns
    # Left column: Client name, Tel 1, Tel 2
    left_column = [f"Client Name: {quote.client_name}"]
    if quote.telephone1:
        left_column.append(f"Tel: {quote.telephone1}")
    if quote.telephone2:
        left_column.append(f"Tel 2: {quote.telephone2}")
    
    # Right column: Company name, Email, Address
    right_column = []
    if quote.company_name:
        right_column.append(f"Company Name: {quote.company_name}")
    if quote.client_email:
        right_column.append(f"Email: {quote.client_email}")
    if quote.client_address:
        right_column.append(f"Address: {quote.client_address}")
    
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
        ["Tax:", f"€{quote.tax:.2f}"],
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
    
    # Add footer
    elements.append(Spacer(1, 0.5*inch))
    
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#666666'),
        alignment=TA_CENTER
    )
    
    footer_text = """
    <b>🌐 Website:</b> itpalsolutions.com &nbsp;&nbsp;|&nbsp;&nbsp; 
    <b>✉ Email:</b> info@itpalsolutions.com &nbsp;&nbsp;|&nbsp;&nbsp; 
    <b>📄 VAT Reg No.:</b> CY111111
    """
    
    elements.append(Paragraph(footer_text, footer_style))
    
    doc.build(elements)
    
    pdf_url = upload_to_s3(filepath, filename)
    
    return pdf_url
