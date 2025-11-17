import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
from app.config import settings

def send_invoice_email(invoice, recipient_email: str, custom_message: str = None):
    if not settings.brevo_api_key:
        print("Brevo API key not configured. Email not sent.")
        return
    
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = settings.brevo_api_key
    
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    subject = f"Invoice {invoice.invoice_number}"
    
    html_content = f"""
    <html>
    <body>
        <h2>Invoice {invoice.invoice_number}</h2>
        <p>Dear {invoice.client_name},</p>
        <p>Please find attached your invoice.</p>
        {f'<p>{custom_message}</p>' if custom_message else ''}
        <p><strong>Total Amount:</strong> ${invoice.total:.2f}</p>
        <p><strong>Due Date:</strong> {invoice.due_date.strftime('%Y-%m-%d')}</p>
        <p>Thank you for your business!</p>
    </body>
    </html>
    """
    
    sender = {"email": "noreply@yourdomain.com", "name": "Invoice System"}
    to = [{"email": recipient_email, "name": invoice.client_name}]
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=to,
        sender=sender,
        subject=subject,
        html_content=html_content
    )
    
    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"Email sent successfully: {api_response}")
    except ApiException as e:
        print(f"Exception when calling Brevo API: {e}")

def send_quote_email(quote, recipient_email: str, custom_message: str = None):
    if not settings.brevo_api_key:
        print("Brevo API key not configured. Email not sent.")
        return
    
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = settings.brevo_api_key
    
    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    
    subject = f"Quote {quote.quote_number}"
    
    html_content = f"""
    <html>
    <body>
        <h2>Quote {quote.quote_number}</h2>
        <p>Dear {quote.client_name},</p>
        <p>Please find attached your quote.</p>
        {f'<p>{custom_message}</p>' if custom_message else ''}
        <p><strong>Total Amount:</strong> ${quote.total:.2f}</p>
        <p><strong>Valid Until:</strong> {quote.valid_until.strftime('%Y-%m-%d')}</p>
        <p>We look forward to working with you!</p>
    </body>
    </html>
    """
    
    sender = {"email": "noreply@yourdomain.com", "name": "Quote System"}
    to = [{"email": recipient_email, "name": quote.client_name}]
    
    send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
        to=to,
        sender=sender,
        subject=subject,
        html_content=html_content
    )
    
    try:
        api_response = api_instance.send_transac_email(send_smtp_email)
        print(f"Email sent successfully: {api_response}")
    except ApiException as e:
        print(f"Exception when calling Brevo API: {e}")
