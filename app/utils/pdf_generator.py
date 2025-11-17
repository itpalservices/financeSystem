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
    
    elements.append(Paragraph("INVOICE", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    info_data = [
        ["Invoice Number:", invoice.invoice_number, "Issue Date:", invoice.issue_date.strftime("%d-%m-%Y")],
        ["Status:", invoice.status.value.upper(), "Due Date:", invoice.due_date.strftime("%d-%m-%Y")]
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
    
    client_data = [["Bill To:"], [invoice.client_name]]
    if invoice.company_name:
        client_data.append([invoice.company_name])
    if invoice.client_email:
        client_data.append([invoice.client_email])
    if invoice.telephone1:
        client_data.append([f"Tel: {invoice.telephone1}"])
    if invoice.telephone2:
        client_data.append([f"Tel 2: {invoice.telephone2}"])
    if invoice.client_address:
        client_data.append([invoice.client_address])
    
    client_table = Table(client_data, colWidths=[7*inch])
    client_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    
    elements.append(client_table)
    elements.append(Spacer(1, 0.3*inch))
    
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
    
    totals_data = [
        ["Subtotal:", f"€{invoice.subtotal:.2f}"],
        ["Tax:", f"€{invoice.tax:.2f}"],
        ["Total:", f"€{invoice.total:.2f}"]
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
    
    client_data = [["Quote For:"], [quote.client_name]]
    if quote.company_name:
        client_data.append([quote.company_name])
    if quote.client_email:
        client_data.append([quote.client_email])
    if quote.telephone1:
        client_data.append([f"Tel: {quote.telephone1}"])
    if quote.telephone2:
        client_data.append([f"Tel 2: {quote.telephone2}"])
    if quote.client_address:
        client_data.append([quote.client_address])
    
    client_table = Table(client_data, colWidths=[7*inch])
    client_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
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
