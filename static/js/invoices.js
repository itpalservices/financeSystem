if (!checkAuth()) {
    window.location.href = '/login';
}

let invoices = [];
let currentInvoice = null;
let editingInvoiceId = null;

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

async function loadInvoices() {
    try {
        invoices = await api.getInvoices();
        renderInvoices();
    } catch (error) {
        showError('Error loading invoices: ' + error.message);
    }
}

let allInvoices = [];

function renderInvoices(invoicesToRender = invoices) {
    const tbody = document.getElementById('invoicesTable');
    
    if (invoicesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No invoices found</td></tr>';
        return;
    }
    
    tbody.innerHTML = invoicesToRender.map(invoice => {
        const statusBadge = getStatusBadge(invoice.status);
        const pdfButtonText = invoice.pdf_url ? 'Preview PDF' : 'Generate PDF';
        const pdfButtonIcon = invoice.pdf_url ? 'bi-eye' : 'bi-file-pdf';
        const canEdit = invoice.status === 'draft';
        const clientInfo = invoice.company_name ? `${invoice.client_name} (${invoice.company_name})` : invoice.client_name;
        const editButton = canEdit ? `<button class="btn btn-outline-warning" onclick="editInvoice(${invoice.id})" title="Edit Draft">
                        <i class="bi bi-pencil"></i>
                    </button>` : '';
        const markIssuedButton = canEdit ? `<button class="btn btn-outline-info" onclick="markAsIssued(${invoice.id})" title="Mark as Issued">
                        <i class="bi bi-check-circle"></i>
                    </button>` : '';
        
        return `
        <tr data-invoice-number="${invoice.invoice_number}" data-client-name="${invoice.client_name}" data-company-name="${invoice.company_name || ''}" data-telephone="${invoice.telephone1 || ''}">
            <td><strong>${invoice.invoice_number}</strong></td>
            <td>${clientInfo}</td>
            <td>${invoice.telephone1 || '-'}</td>
            <td><strong>€${invoice.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    ${editButton}
                    ${markIssuedButton}
                    <button class="btn btn-outline-primary" onclick="generatePDF(${invoice.id})" title="${pdfButtonText}">
                        <i class="bi ${pdfButtonIcon}"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="openEmailModal(${invoice.id})" title="Send Email">
                        <i class="bi bi-envelope"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteInvoice(${invoice.id})" title="Delete">
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
        'issued': '<span class="badge bg-success">Issued</span>'
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

function resetLineItems() {
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

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitter = e.submitter;
    const action = submitter.getAttribute('value');
    
    const lineItemsElements = document.querySelectorAll('.line-item-row');
    const lineItems = Array.from(lineItemsElements).map(item => ({
        description: item.querySelector('.item-desc').value,
        quantity: parseInt(item.querySelector('.item-qty').value),
        unit_price: parseFloat(item.querySelector('.item-price').value),
        discount: parseFloat(item.querySelector('.item-discount').value) || 0
    }));
    
    if (lineItems.length === 0) {
        showModalError('Please add at least one line item');
        return;
    }
    
    const clientName = document.getElementById('clientName').value.trim();
    const companyName = document.getElementById('companyName').value.trim();
    
    // Validate that at least one of client name or company name is provided
    if (!clientName && !companyName) {
        showModalError('Either Client Name or Company Name must be provided');
        return;
    }
    
    const data = {
        client_name: clientName || null,
        company_name: companyName || null,
        client_email: document.getElementById('clientEmail').value || null,
        telephone1: document.getElementById('telephone1').value,
        telephone2: document.getElementById('telephone2').value || null,
        client_address: document.getElementById('clientAddress').value,
        client_reg_no: document.getElementById('clientRegNo').value || null,
        client_tax_id: document.getElementById('clientTaxId').value || null,
        discount: parseFloat(document.getElementById('discount').value) || 0,
        tax: parseFloat(document.getElementById('tax').value) || 0,
        notes: document.getElementById('notes').value,
        status: action,
        line_items: lineItems
    };
    
    try {
        let invoice;
        const isEditing = editingInvoiceId !== null;
        
        if (isEditing) {
            invoice = await api.updateInvoice(editingInvoiceId, data);
            showSuccess(`Invoice updated successfully`);
        } else {
            invoice = await api.createInvoice(data);
            showSuccess(`Invoice ${action === 'draft' ? 'saved as draft' : 'created'} successfully`);
        }
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
        modal.hide();
        document.getElementById('createForm').reset();
        
        document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-file-earmark-plus"></i> Create Invoice';
        resetLineItems();
        editingInvoiceId = null;
        
        loadInvoices();
        
        if (action === 'issued' && !isEditing) {
            setTimeout(() => generatePDF(invoice.id), 500);
        }
    } catch (error) {
        showModalError(`Error ${editingInvoiceId ? 'updating' : 'creating'} invoice: ` + error.message);
    }
});

async function generateOrPreviewPDF(invoiceId, action = 'preview') {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    if (action === 'generate' && invoice.pdf_url) {
        const confirmed = await showConfirmDialog(
            'Regenerate PDF?',
            'A PDF already exists for this invoice. Do you want to generate a new one?'
        );
        if (!confirmed) return;
    }
    
    if (action === 'preview' && invoice.pdf_url) {
        showPDFPreview(invoice.pdf_url, invoice.invoice_number);
        return;
    }
    
    try {
        showSuccess('Generating PDF...');
        const result = await api.generateInvoicePDF(invoiceId);
        
        showPDFPreview(result.pdf_url, invoice.invoice_number);
        
        loadInvoices();
    } catch (error) {
        showError('Error generating PDF: ' + error.message);
    }
}

async function generatePDF(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    const action = invoice && invoice.pdf_url ? 'preview' : 'generate';
    await generateOrPreviewPDF(invoiceId, action);
}

function showPDFPreview(pdfUrl, invoiceNumber) {
    const container = document.getElementById('pdfPreviewContainer');
    container.innerHTML = `<iframe src="${pdfUrl}" style="width: 100%; height: 600px; border: none; background: white;"></iframe>`;
    
    document.getElementById('pdfDownloadBtn').href = pdfUrl;
    document.getElementById('pdfDownloadBtn').download = `${invoiceNumber}.pdf`;
    
    const modal = new bootstrap.Modal(document.getElementById('pdfPreviewModal'));
    modal.show();
}

async function openEmailModal(invoiceId) {
    currentInvoice = invoices.find(inv => inv.id === invoiceId);
    if (!currentInvoice) {
        showError('Invoice not found');
        return;
    }
    
    if (!currentInvoice.pdf_url) {
        const confirmed = await showConfirmDialog(
            'Generate PDF First?',
            'This invoice does not have a PDF yet. Generate one now?'
        );
        if (confirmed) {
            await generateOrPreviewPDF(invoiceId, 'generate');
            await new Promise(resolve => setTimeout(resolve, 1000));
            currentInvoice = invoices.find(inv => inv.id === invoiceId);
            if (!currentInvoice.pdf_url) {
                showError('Failed to generate PDF');
                return;
            }
        } else {
            return;
        }
    }
    
    document.getElementById('emailTo').value = currentInvoice.client_email || '';
    document.getElementById('emailSubject').value = `Invoice ${currentInvoice.invoice_number} from I.T. PAL Technology Solutions`;
    document.getElementById('emailBody').value = `Dear ${currentInvoice.client_name},

Please find attached invoice ${currentInvoice.invoice_number} for the amount of €${currentInvoice.total.toFixed(2)}.

If you have any questions, please don't hesitate to contact us.

Best regards,
I.T. PAL Technology Solutions Ltd`;
    
    document.getElementById('emailAttachment').textContent = `${currentInvoice.invoice_number}.pdf`;
    
    const previewContainer = document.getElementById('emailPdfPreviewContainer');
    previewContainer.innerHTML = `<iframe src="${currentInvoice.pdf_url}" style="width: 100%; height: 300px; border: none; background: white;"></iframe>`;
    
    const modal = new bootstrap.Modal(document.getElementById('emailModal'));
    modal.show();
}

document.getElementById('emailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentInvoice) return;
    
    const recipientEmail = document.getElementById('emailTo').value;
    const subject = document.getElementById('emailSubject').value;
    const message = document.getElementById('emailBody').value;
    
    const confirmed = await showConfirmDialog(
        'Send Email?',
        `Send invoice ${currentInvoice.invoice_number} to ${recipientEmail}?`
    );
    if (!confirmed) return;
    
    try {
        await api.sendInvoiceEmail(currentInvoice.id, recipientEmail, message, subject);
        showSuccess('Email sent successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('emailModal'));
        modal.hide();
        
        loadInvoices();
    } catch (error) {
        showError('Error sending email: ' + error.message);
    }
});

async function editInvoice(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showError('Invoice not found');
        return;
    }
    
    if (invoice.status !== 'draft') {
        showError('Only draft invoices can be edited');
        return;
    }
    
    editingInvoiceId = invoiceId;
    
    document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-pencil"></i> Edit Draft Invoice';
    document.getElementById('markIssuedModalBtn').style.display = 'inline-block';
    
    document.getElementById('clientName').value = invoice.client_name;
    document.getElementById('companyName').value = invoice.company_name || '';
    document.getElementById('clientEmail').value = invoice.client_email || '';
    document.getElementById('telephone1').value = invoice.telephone1 || '';
    document.getElementById('telephone2').value = invoice.telephone2 || '';
    document.getElementById('clientRegNo').value = invoice.client_reg_no || '';
    document.getElementById('clientTaxId').value = invoice.client_tax_id || '';
    document.getElementById('clientAddress').value = invoice.client_address || '';
    document.getElementById('discount').value = invoice.discount || 0;
    document.getElementById('tax').value = invoice.tax || 0;
    document.getElementById('notes').value = invoice.notes || '';
    
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = '';
    
    invoice.line_items.forEach(item => {
        const newItem = document.createElement('div');
        newItem.className = 'line-item-row';
        newItem.innerHTML = `
            <div class="row g-2">
                <div class="col-md-4">
                    <label class="form-label text-muted small mb-1">Description *</label>
                    <textarea class="form-control item-desc" rows="2" placeholder="Enter item description" required>${item.description}</textarea>
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
    
    const modal = new bootstrap.Modal(document.getElementById('createModal'));
    modal.show();
    
    document.getElementById('createModal').addEventListener('hidden.bs.modal', function resetModal() {
        document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-file-earmark-plus"></i> Create Invoice';
        document.getElementById('markIssuedModalBtn').style.display = 'none';
        editingInvoiceId = null;
        document.getElementById('createForm').reset();
        resetLineItems();
        document.getElementById('createModal').removeEventListener('hidden.bs.modal', resetModal);
    }, { once: true });
}

async function deleteInvoice(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    const confirmed = await showConfirmDialog(
        'Delete Invoice?',
        `Are you sure you want to permanently delete invoice ${invoice ? invoice.invoice_number : invoiceId}? This action cannot be undone.`,
        'Delete',
        true
    );
    if (!confirmed) return;
    
    try {
        await api.deleteInvoice(invoiceId);
        showSuccess('Invoice deleted successfully');
        loadInvoices();
    } catch (error) {
        showError('Error deleting invoice: ' + error.message);
    }
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

function showSuccess(message) {
    document.getElementById('successToastMessage').textContent = message;
    const toast = new bootstrap.Toast(document.getElementById('successToast'), { delay: 3000 });
    toast.show();
}

async function markAsIssued(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showError('Invoice not found');
        return;
    }
    
    if (invoice.status !== 'draft') {
        showError('Only draft invoices can be marked as issued');
        return;
    }
    
    const confirmed = await showConfirmDialog(
        'Mark as Issued?',
        `Mark invoice ${invoice.invoice_number} as issued? This will finalize the invoice.`,
        'Mark as Issued'
    );
    if (!confirmed) return;
    
    try {
        await api.updateInvoice(invoiceId, { 
            status: 'issued',
            telephone1: invoice.telephone1
        });
        showSuccess('Invoice marked as issued successfully');
        loadInvoices();
    } catch (error) {
        showError('Error marking invoice as issued: ' + error.message);
    }
}

async function markAsIssuedFromModal() {
    if (!editingInvoiceId) return;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('createModal'));
    modal.hide();
    
    await markAsIssued(editingInvoiceId);
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderInvoices(invoices);
        return;
    }
    
    const filteredInvoices = invoices.filter(invoice => {
        return invoice.invoice_number.toLowerCase().includes(searchTerm) ||
               invoice.client_name.toLowerCase().includes(searchTerm) ||
               (invoice.company_name && invoice.company_name.toLowerCase().includes(searchTerm)) ||
               (invoice.telephone1 && invoice.telephone1.includes(searchTerm));
    });
    
    renderInvoices(filteredInvoices);
});

loadInvoices();
