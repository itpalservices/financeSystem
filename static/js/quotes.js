if (!checkAuth()) {
    window.location.href = '/login';
}

let quotes = [];
let currentQuote = null;

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

async function loadQuotes() {
    try {
        quotes = await api.getQuotes();
        renderQuotes();
    } catch (error) {
        showError('Error loading quotes: ' + error.message);
    }
}

function renderQuotes() {
    const tbody = document.getElementById('quotesTable');
    
    if (quotes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No quotes found</td></tr>';
        return;
    }
    
    tbody.innerHTML = quotes.map(quote => {
        const statusBadge = getStatusBadge(quote.status);
        const pdfButtonText = quote.pdf_url ? 'Preview PDF' : 'Generate PDF';
        const pdfButtonIcon = quote.pdf_url ? 'bi-eye' : 'bi-file-pdf';
        const canEdit = quote.status === 'draft';
        const convertBtn = quote.status !== 'converted' 
            ? `<button class="btn btn-outline-warning btn-sm" onclick="convertToInvoice(${quote.id})" title="Convert to Invoice">
                    <i class="bi bi-arrow-right-circle"></i>
               </button>` 
            : '';
        const editButton = canEdit ? `<button class="btn btn-outline-secondary" onclick="editQuote(${quote.id})" title="Edit Draft">
                        <i class="bi bi-pencil"></i>
                    </button>` : '';
        return `
        <tr>
            <td><strong>${quote.quote_number}</strong></td>
            <td>${quote.company_name ? `${quote.client_name} (${quote.company_name})` : quote.client_name}<br><small class="text-muted">${quote.client_email || quote.telephone1}</small></td>
            <td><strong>€${quote.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>${formatDate(quote.valid_until)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    ${editButton}
                    ${convertBtn}
                    <button class="btn btn-outline-primary" onclick="generatePDF(${quote.id})" title="${pdfButtonText}">
                        <i class="bi ${pdfButtonIcon}"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="openEmailModal(${quote.id})" title="Send Email">
                        <i class="bi bi-envelope"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteQuote(${quote.id})" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

function getStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge bg-secondary">Draft</span>',
        'sent': '<span class="badge bg-info">Sent</span>',
        'accepted': '<span class="badge bg-success">Accepted</span>',
        'rejected': '<span class="badge bg-danger">Rejected</span>',
        'converted': '<span class="badge bg-primary">Converted</span>'
    };
    return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
}

function addLineItem() {
    const lineItems = document.getElementById('lineItems');
    const newItem = document.createElement('div');
    newItem.className = 'line-item-row';
    newItem.innerHTML = `
        <div class="row g-2">
            <div class="col-md-5">
                <input type="text" class="form-control item-desc" placeholder="Description *" required>
            </div>
            <div class="col-md-2">
                <input type="number" class="form-control item-qty" placeholder="Qty *" min="1" required>
            </div>
            <div class="col-md-3">
                <input type="number" class="form-control item-price" placeholder="Unit Price *" step="0.01" required>
            </div>
            <div class="col-md-2">
                <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeLineItem(this)">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
    lineItems.appendChild(newItem);
}

function removeLineItem(button) {
    const lineItemRow = button.closest('.line-item-row');
    if (document.querySelectorAll('.line-item-row').length > 1) {
        lineItemRow.remove();
    } else {
        showError('At least one line item is required');
    }
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitter = e.submitter;
    const action = submitter.getAttribute('value');
    
    const lineItemsElements = document.querySelectorAll('.line-item-row');
    const lineItems = Array.from(lineItemsElements).map(item => ({
        description: item.querySelector('.item-desc').value,
        quantity: parseInt(item.querySelector('.item-qty').value),
        unit_price: parseFloat(item.querySelector('.item-price').value)
    }));
    
    if (lineItems.length === 0) {
        showError('Please add at least one line item');
        return;
    }
    
    const data = {
        client_name: document.getElementById('clientName').value,
        company_name: document.getElementById('companyName').value || null,
        client_email: document.getElementById('clientEmail').value || null,
        telephone1: document.getElementById('telephone1').value,
        telephone2: document.getElementById('telephone2').value || null,
        client_address: document.getElementById('clientAddress').value,
        valid_until: new Date(document.getElementById('validUntil').value).toISOString(),
        tax: parseFloat(document.getElementById('tax').value) || 0,
        notes: document.getElementById('notes').value,
        status: action,
        line_items: lineItems
    };
    
    try {
        const quote = await api.createQuote(data);
        showSuccess(`Quote ${action === 'draft' ? 'saved as draft' : 'created'} successfully`);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
        modal.hide();
        document.getElementById('createForm').reset();
        
        loadQuotes();
        
        if (action === 'sent') {
            setTimeout(() => generatePDF(quote.id), 500);
        }
    } catch (error) {
        showError('Error creating quote: ' + error.message);
    }
});

async function convertToInvoice(quoteId) {
    if (!confirm('Convert this quote to an invoice?')) return;
    
    try {
        const result = await api.convertQuoteToInvoice(quoteId);
        showSuccess('Quote converted to invoice successfully');
        loadQuotes();
        
        setTimeout(() => {
            window.location.href = '/invoices';
        }, 1500);
    } catch (error) {
        showError('Error converting quote: ' + error.message);
    }
}

async function generateOrPreviewPDF(quoteId, action = 'preview') {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;
    
    if (action === 'generate' && quote.pdf_url) {
        const confirmed = await showConfirmDialog(
            'Regenerate PDF?',
            'A PDF already exists for this quote. Do you want to generate a new one?'
        );
        if (!confirmed) return;
    }
    
    if (action === 'preview' && quote.pdf_url) {
        showPDFPreview(quote.pdf_url, quote.quote_number);
        return;
    }
    
    try {
        showSuccess('Generating PDF...');
        const result = await api.generateQuotePDF(quoteId);
        
        showPDFPreview(result.pdf_url, quote.quote_number);
        
        loadQuotes();
    } catch (error) {
        showError('Error generating PDF: ' + error.message);
    }
}

async function generatePDF(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    const action = quote && quote.pdf_url ? 'preview' : 'generate';
    await generateOrPreviewPDF(quoteId, action);
}

function showPDFPreview(pdfUrl, quoteNumber) {
    const container = document.getElementById('pdfPreviewContainer');
    container.innerHTML = `<iframe src="${pdfUrl}" style="width: 100%; height: 600px; border: none; background: white;"></iframe>`;
    
    document.getElementById('pdfDownloadBtn').href = pdfUrl;
    document.getElementById('pdfDownloadBtn').download = `${quoteNumber}.pdf`;
    
    const modal = new bootstrap.Modal(document.getElementById('pdfPreviewModal'));
    modal.show();
}

async function openEmailModal(quoteId) {
    currentQuote = quotes.find(q => q.id === quoteId);
    if (!currentQuote) {
        showError('Quote not found');
        return;
    }
    
    if (!currentQuote.pdf_url) {
        const confirmed = await showConfirmDialog(
            'Generate PDF First?',
            'This quote does not have a PDF yet. Generate one now?'
        );
        if (confirmed) {
            await generateOrPreviewPDF(quoteId, 'generate');
            await new Promise(resolve => setTimeout(resolve, 1000));
            currentQuote = quotes.find(q => q.id === quoteId);
            if (!currentQuote.pdf_url) {
                showError('Failed to generate PDF');
                return;
            }
        } else {
            return;
        }
    }
    
    document.getElementById('emailTo').value = currentQuote.client_email || '';
    document.getElementById('emailSubject').value = `Quote ${currentQuote.quote_number} from I.T. PAL Technology Solutions`;
    document.getElementById('emailBody').value = `Dear ${currentQuote.client_name},

Please find attached quote ${currentQuote.quote_number} for the amount of €${currentQuote.total.toFixed(2)}.

This quote is valid until ${formatDate(currentQuote.valid_until)}.

If you have any questions or would like to proceed, please don't hesitate to contact us.

Best regards,
I.T. PAL Technology Solutions Ltd`;
    
    document.getElementById('emailAttachment').textContent = `${currentQuote.quote_number}.pdf`;
    
    const previewContainer = document.getElementById('emailPdfPreviewContainer');
    previewContainer.innerHTML = `<iframe src="${currentQuote.pdf_url}" style="width: 100%; height: 300px; border: none; background: white;"></iframe>`;
    
    const modal = new bootstrap.Modal(document.getElementById('emailModal'));
    modal.show();
}

document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentQuote) return;
    
    const recipientEmail = document.getElementById('emailTo').value;
    const subject = document.getElementById('emailSubject').value;
    const message = document.getElementById('emailBody').value;
    
    const confirmed = await showConfirmDialog(
        'Send Email?',
        `Send quote ${currentQuote.quote_number} to ${recipientEmail}?`
    );
    if (!confirmed) return;
    
    try {
        await api.sendQuoteEmail(currentQuote.id, recipientEmail, message, subject);
        showSuccess('Email sent successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('emailModal'));
        modal.hide();
        
        loadQuotes();
    } catch (error) {
        showError('Error sending email: ' + error.message);
    }
});

async function editQuote(quoteId) {
    showError('Edit functionality coming soon. For now, please delete and recreate the draft quote.');
}

async function deleteQuote(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    const confirmed = await showConfirmDialog(
        'Delete Quote?',
        `Are you sure you want to permanently delete quote ${quote ? quote.quote_number : quoteId}? This action cannot be undone.`
    );
    if (!confirmed) return;
    
    try {
        await api.deleteQuote(quoteId);
        showSuccess('Quote deleted successfully');
        loadQuotes();
    } catch (error) {
        showError('Error deleting quote: ' + error.message);
    }
}

async function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
        const result = confirm(`${title}\n\n${message}`);
        resolve(result);
    });
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 3000);
}

loadQuotes();
