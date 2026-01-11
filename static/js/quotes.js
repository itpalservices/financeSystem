if (!checkAuth()) {
    window.location.href = '/login';
}

let quotes = [];
let currentQuote = null;
let editingQuoteId = null;
let customers = [];

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

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers/', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            customers = await response.json();
            populateCustomerDropdown();
        }
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

function populateCustomerDropdown() {
    const select = document.getElementById('customerSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- New Customer / Enter Details Manually --</option>';
    
    customers.filter(c => c.is_active).forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        const displayName = customer.company_name 
            ? `${customer.name || ''} (${customer.company_name})`.trim()
            : customer.name || customer.telephone1;
        option.textContent = displayName;
        select.appendChild(option);
    });
}

function populateFromCustomer() {
    const select = document.getElementById('customerSelect');
    const customerId = select.value;
    
    if (!customerId) {
        clearCustomerFields();
        return;
    }
    
    const customer = customers.find(c => c.id == customerId);
    if (!customer) return;
    
    document.getElementById('clientName').value = customer.name || '';
    document.getElementById('companyName').value = customer.company_name || '';
    document.getElementById('clientEmail').value = customer.email || '';
    document.getElementById('telephone1').value = customer.telephone1 || '';
    document.getElementById('telephone2').value = customer.telephone2 || '';
    document.getElementById('clientRegNo').value = customer.client_reg_no || '';
    document.getElementById('clientTaxId').value = customer.client_tax_id || '';
    document.getElementById('clientAddress').value = customer.address || '';
}

function clearCustomerSelection() {
    document.getElementById('customerSelect').value = '';
    clearCustomerFields();
}

function clearCustomerFields() {
    document.getElementById('clientName').value = '';
    document.getElementById('companyName').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('telephone1').value = '';
    document.getElementById('telephone2').value = '';
    document.getElementById('clientRegNo').value = '';
    document.getElementById('clientTaxId').value = '';
    document.getElementById('clientAddress').value = '';
}

function renderQuotes(quotesToRender = quotes) {
    const tbody = document.getElementById('quotesTable');
    
    if (quotesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No quotes found</td></tr>';
        return;
    }
    
    tbody.innerHTML = quotesToRender.map(quote => {
        const statusBadge = getStatusBadge(quote.status);
        const pdfButtonText = quote.pdf_url ? 'Preview PDF' : 'Generate PDF';
        const pdfButtonIcon = quote.pdf_url ? 'bi-eye' : 'bi-file-pdf';
        const canEdit = quote.status === 'draft';
        const canConvert = quote.status === 'issued';
        const isCancelled = quote.status === 'cancelled';
        const canCancel = quote.status === 'issued' || quote.status === 'invoiced';
        
        const convertBtn = canConvert 
            ? `<button class="btn btn-outline-warning btn-sm" onclick="convertToInvoice(${quote.id})" title="Convert to Invoice">
                    <i class="bi bi-arrow-right-circle"></i>
               </button>` 
            : '';
        const editButton = canEdit ? `<button class="btn btn-outline-secondary" onclick="editQuote(${quote.id})" title="Edit Draft">
                        <i class="bi bi-pencil"></i>
                    </button>` : '';
        const markIssuedBtn = quote.status === 'draft' 
            ? `<button class="btn btn-outline-info" onclick="markAsIssued(${quote.id})" title="Mark as Issued">
                    <i class="bi bi-check-circle"></i>
               </button>` 
            : '';
        
        const deleteButton = canEdit ? `<button class="btn btn-outline-danger" onclick="deleteQuote(${quote.id})" title="Delete Draft">
                        <i class="bi bi-trash"></i>
                    </button>` : '';
        
        const cancelButton = canCancel ? `<button class="btn btn-outline-danger" onclick="openCancelModal(${quote.id})" title="Cancel Quote">
                        <i class="bi bi-x-circle"></i>
                    </button>` : '';
        
        const cancelledInfo = isCancelled && quote.cancel_reason ? `<small class="text-muted d-block">Reason: ${quote.cancel_reason}</small>` : '';
        
        return `
        <tr class="${isCancelled ? 'table-secondary' : ''}">
            <td><strong>${quote.quote_number}</strong>${cancelledInfo}</td>
            <td>${quote.client_name || '-'}</td>
            <td>${quote.company_name || '-'}</td>
            <td>${quote.telephone1 || '-'}</td>
            <td><strong>€${quote.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>${formatDate(quote.valid_until)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    ${editButton}
                    ${markIssuedBtn}
                    ${convertBtn}
                    <button class="btn btn-outline-primary" onclick="generatePDF(${quote.id})" title="${isCancelled ? 'View Cancelled PDF' : pdfButtonText}">
                        <i class="bi ${pdfButtonIcon}"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="openEmailModal(${quote.id})" title="Send Email" ${isCancelled ? 'disabled' : ''}>
                        <i class="bi bi-envelope"></i>
                    </button>
                    ${cancelButton}
                    ${deleteButton}
                </div>
            </td>
        </tr>
    `}).join('');
}

function getStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge bg-secondary">Draft</span>',
        'issued': '<span class="badge bg-success">Issued</span>',
        'invoiced': '<span class="badge bg-primary">Invoiced</span>',
        'cancelled': '<span class="badge bg-danger">Cancelled</span>',
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
            <div class="col-md-4">
                <label class="form-label text-muted small mb-1">Description *</label>
                <textarea class="form-control item-desc" rows="2" placeholder="Enter item description" required></textarea>
            </div>
            <div class="col-md-2">
                <label class="form-label text-muted small mb-1">Quantity *</label>
                <input type="number" class="form-control item-qty" placeholder="Qty" min="1" required>
            </div>
            <div class="col-md-2">
                <label class="form-label text-muted small mb-1">Unit Price *</label>
                <input type="number" class="form-control item-price" placeholder="€0.00" step="0.01" required>
            </div>
            <div class="col-md-2">
                <label class="form-label text-muted small mb-1">Discount %</label>
                <input type="number" class="form-control item-discount" placeholder="0" step="0.01" value="0" min="0" max="100">
            </div>
            <div class="col-md-2">
                <label class="form-label text-muted small mb-1">&nbsp;</label>
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

function showModalError(message) {
    let modalError = document.getElementById('modalError');
    if (!modalError) {
        const modalBody = document.querySelector('#createModal .modal-body');
        modalError = document.createElement('div');
        modalError.id = 'modalError';
        modalError.className = 'alert alert-danger';
        modalError.style.display = 'none';
        modalBody.insertBefore(modalError, modalBody.firstChild);
    }
    modalError.textContent = message;
    modalError.style.display = 'block';
    setTimeout(() => modalError.style.display = 'none', 5000);
}

function resetQuoteForm() {
    editingQuoteId = null;
    document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-file-earmark-plus"></i> Create Quote';
    document.getElementById('markIssuedModalBtn').style.display = 'none';
    document.getElementById('submitBtnText').textContent = 'Create';
    document.getElementById('submitBtnIcon').className = 'bi bi-plus-circle';
    document.getElementById('createForm').reset();
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = `
        <div class="line-item-row">
            <div class="row g-2">
                <div class="col-md-4">
                    <label class="form-label text-muted small mb-1">Description *</label>
                    <textarea class="form-control item-desc" rows="2" placeholder="Enter item description" required></textarea>
                </div>
                <div class="col-md-2">
                    <label class="form-label text-muted small mb-1">Quantity *</label>
                    <input type="number" class="form-control item-qty" placeholder="Qty" min="1" required>
                </div>
                <div class="col-md-2">
                    <label class="form-label text-muted small mb-1">Unit Price *</label>
                    <input type="number" class="form-control item-price" placeholder="€0.00" step="0.01" required>
                </div>
                <div class="col-md-2">
                    <label class="form-label text-muted small mb-1">Discount %</label>
                    <input type="number" class="form-control item-discount" placeholder="0" step="0.01" value="0" min="0" max="100">
                </div>
                <div class="col-md-2">
                    <label class="form-label text-muted small mb-1">&nbsp;</label>
                    <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeLineItem(this)">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

document.getElementById('createModal').addEventListener('hidden.bs.modal', function() {
    resetQuoteForm();
});

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const clientName = document.getElementById('clientName').value.trim();
    const companyName = document.getElementById('companyName').value.trim();
    
    if (!clientName && !companyName) {
        showModalError('Please provide at least Client Name or Company Name');
        return;
    }
    
    const lineItemsElements = document.querySelectorAll('.line-item-row');
    const lineItems = Array.from(lineItemsElements).map(item => ({
        description: item.querySelector('.item-desc').value,
        quantity: parseInt(item.querySelector('.item-qty').value),
        unit_price: parseFloat(item.querySelector('.item-price').value),
        discount: parseFloat(item.querySelector('.item-discount')?.value) || 0
    }));
    
    if (lineItems.length === 0) {
        showModalError('Please add at least one line item');
        return;
    }
    
    const data = {
        client_name: clientName || null,
        company_name: companyName || null,
        client_email: document.getElementById('clientEmail').value || null,
        telephone1: document.getElementById('telephone1').value,
        telephone2: document.getElementById('telephone2').value || null,
        client_reg_no: document.getElementById('clientRegNo').value || null,
        client_tax_id: document.getElementById('clientTaxId').value || null,
        client_address: document.getElementById('clientAddress').value,
        valid_until: new Date(document.getElementById('validUntil').value).toISOString(),
        discount: parseFloat(document.getElementById('discount').value) || 0,
        tax: parseFloat(document.getElementById('tax').value) || 0,
        notes: document.getElementById('notes').value,
        line_items: lineItems
    };
    
    try {
        if (editingQuoteId) {
            await api.updateQuote(editingQuoteId, data);
            showSuccess('Quote updated successfully');
        } else {
            await api.createQuote(data);
            showSuccess('Quote created successfully');
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
        modal.hide();
        
        loadQuotes();
    } catch (error) {
        showError('Error ' + (editingQuoteId ? 'updating' : 'creating') + ' quote: ' + error.message);
    }
});

async function convertToInvoice(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    const confirmed = await showConfirmDialog(
        'Convert to Invoice?',
        `Convert quote ${quote ? quote.quote_number : quoteId} to an invoice?`,
        'Convert'
    );
    if (!confirmed) return;
    
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
    document.getElementById('emailSubject').value = `Quote ${currentQuote.quote_number} from IT PAL Technology Solutions`;
    document.getElementById('emailBody').value = `Dear ${currentQuote.client_name},

Please find attached quote ${currentQuote.quote_number} for the amount of €${currentQuote.total.toFixed(2)}.

This quote is valid until ${formatDate(currentQuote.valid_until)}.

If you have any questions or would like to proceed, please don't hesitate to contact us.

Best regards,
IT PAL Technology Solutions Ltd`;
    
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
    editingQuoteId = quoteId;
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) {
        showError('Quote not found');
        return;
    }
    
    if (quote.status !== 'draft') {
        showError('Only draft quotes can be edited');
        return;
    }
    
    document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-pencil"></i> Edit Quote';
    document.getElementById('markIssuedModalBtn').style.display = 'inline-block';
    document.getElementById('submitBtnText').textContent = 'Save';
    document.getElementById('submitBtnIcon').className = 'bi bi-check-lg';
    
    document.getElementById('clientName').value = quote.client_name || '';
    document.getElementById('companyName').value = quote.company_name || '';
    document.getElementById('clientEmail').value = quote.client_email || '';
    document.getElementById('telephone1').value = quote.telephone1 || '';
    document.getElementById('telephone2').value = quote.telephone2 || '';
    document.getElementById('clientRegNo').value = quote.client_reg_no || '';
    document.getElementById('clientTaxId').value = quote.client_tax_id || '';
    document.getElementById('clientAddress').value = quote.client_address || '';
    document.getElementById('validUntil').value = quote.valid_until ? quote.valid_until.split('T')[0] : '';
    document.getElementById('discount').value = quote.discount || 0;
    document.getElementById('tax').value = quote.tax || 0;
    document.getElementById('notes').value = quote.notes || '';
    
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = '';
    
    if (quote.line_items && quote.line_items.length > 0) {
        quote.line_items.forEach((item, index) => {
            const newItem = document.createElement('div');
            newItem.className = 'line-item-row';
            newItem.innerHTML = `
                <div class="row g-2">
                    <div class="col-md-4">
                        <label class="form-label text-muted small mb-1">Description *</label>
                        <textarea class="form-control item-desc" rows="2" placeholder="Enter item description" required>${item.description || ''}</textarea>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label text-muted small mb-1">Quantity *</label>
                        <input type="number" class="form-control item-qty" placeholder="Qty" min="1" value="${item.quantity}" required>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label text-muted small mb-1">Unit Price *</label>
                        <input type="number" class="form-control item-price" placeholder="€0.00" step="0.01" value="${item.unit_price}" required>
                    </div>
                    <div class="col-md-2">
                        <label class="form-label text-muted small mb-1">Discount %</label>
                        <input type="number" class="form-control item-discount" placeholder="0" step="0.01" value="${item.discount || 0}" min="0" max="100">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label text-muted small mb-1">&nbsp;</label>
                        <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeLineItem(this)">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            lineItemsContainer.appendChild(newItem);
        });
    } else {
        addLineItem();
    }
    
    const modal = new bootstrap.Modal(document.getElementById('createModal'));
    modal.show();
}

async function deleteQuote(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    const confirmed = await showConfirmDialog(
        'Delete Quote?',
        `Are you sure you want to permanently delete quote ${quote ? quote.quote_number : quoteId}? This action cannot be undone.`,
        'Delete',
        true
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

function toggleOtherReason(type) {
    const select = document.getElementById('cancelReasonSelect');
    const container = document.getElementById('otherReasonContainer');
    const textInput = document.getElementById('otherReasonText');
    
    if (select.value === 'Other') {
        container.style.display = 'block';
        textInput.required = true;
    } else {
        container.style.display = 'none';
        textInput.required = false;
        textInput.value = '';
    }
}

function openCancelModal(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) {
        showError('Quote not found');
        return;
    }
    
    document.getElementById('cancelQuoteId').value = quoteId;
    document.getElementById('cancelQuoteNumber').textContent = quote.quote_number;
    document.getElementById('cancelReasonSelect').value = '';
    document.getElementById('otherReasonText').value = '';
    document.getElementById('otherReasonContainer').style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('cancelModal'));
    modal.show();
}

document.getElementById('confirmCancelBtn').addEventListener('click', async function() {
    const quoteId = parseInt(document.getElementById('cancelQuoteId').value);
    const selectValue = document.getElementById('cancelReasonSelect').value;
    const otherText = document.getElementById('otherReasonText').value.trim();
    
    if (!selectValue) {
        showError('Please select a reason for cancelling the quote');
        return;
    }
    
    let reason = selectValue;
    if (selectValue === 'Other') {
        if (!otherText) {
            showError('Please specify the reason for cancelling');
            return;
        }
        reason = `Other: ${otherText}`;
    }
    
    try {
        await api.cancelQuote(quoteId, reason);
        showSuccess('Quote cancelled successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('cancelModal'));
        modal.hide();
        
        loadQuotes();
    } catch (error) {
        showError('Error cancelling quote: ' + error.message);
    }
});

async function markAsIssued(quoteId) {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) {
        showError('Quote not found');
        return;
    }
    
    if (quote.status !== 'draft') {
        showError('Only draft quotes can be marked as issued');
        return;
    }
    
    const confirmed = await showConfirmDialog(
        'Mark as Issued?',
        `Mark quote ${quote.quote_number} as issued? This will finalize the quote.`,
        'Mark as Issued'
    );
    if (!confirmed) return;
    
    try {
        await api.updateQuote(quoteId, { 
            status: 'issued',
            telephone1: quote.telephone1
        });
        showSuccess('Quote marked as issued successfully');
        loadQuotes();
    } catch (error) {
        showError('Error marking quote as issued: ' + error.message);
    }
}

async function markAsIssuedFromModal() {
    if (!editingQuoteId) return;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
    modal.hide();
    
    await markAsIssued(editingQuoteId);
}

async function showConfirmDialog(title, message, confirmText = 'Confirm', isDanger = false) {
    return new Promise((resolve) => {
        document.getElementById('confirmModalTitle').textContent = title;
        document.getElementById('confirmModalMessage').textContent = message;
        
        const confirmBtn = document.getElementById('confirmModalBtn');
        confirmBtn.textContent = confirmText;
        confirmBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
        
        const modalElement = document.getElementById('confirmModal');
        const modal = new bootstrap.Modal(modalElement);
        let resolved = false;
        
        const handleConfirm = () => {
            resolved = true;
            confirmBtn.removeEventListener('click', handleConfirm);
            modal.hide();
            resolve(true);
        };
        
        const handleHidden = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            if (!resolved) {
                resolve(false);
            }
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        modalElement.addEventListener('hidden.bs.modal', handleHidden, { once: true });
        
        modal.show();
    });
}

function showError(message) {
    document.getElementById('errorToastMessage').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('errorToast'), { delay: 5000 });
    toast.show();
}

function showSuccess(message) {
    document.getElementById('successToastMessage').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('successToast'), { delay: 3000 });
    toast.show();
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderQuotes(quotes);
        return;
    }
    
    const filteredQuotes = quotes.filter(quote => {
        return quote.quote_number.toLowerCase().includes(searchTerm) ||
               (quote.client_name && quote.client_name.toLowerCase().includes(searchTerm)) ||
               (quote.company_name && quote.company_name.toLowerCase().includes(searchTerm)) ||
               (quote.telephone1 && quote.telephone1.includes(searchTerm));
    });
    
    renderQuotes(filteredQuotes);
});

loadQuotes();
loadCustomers();
