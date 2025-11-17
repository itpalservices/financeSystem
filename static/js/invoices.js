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

function renderInvoices() {
    const tbody = document.getElementById('invoicesTable');
    
    if (invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No invoices found</td></tr>';
        return;
    }
    
    tbody.innerHTML = invoices.map(invoice => {
        const statusBadge = getStatusBadge(invoice.status);
        const pdfButtonText = invoice.pdf_url ? 'Preview PDF' : 'Generate PDF';
        const pdfButtonIcon = invoice.pdf_url ? 'bi-eye' : 'bi-file-pdf';
        const canEdit = invoice.status === 'draft';
        const clientInfo = invoice.company_name ? `${invoice.client_name} (${invoice.company_name})` : invoice.client_name;
        const contactInfo = invoice.client_email ? invoice.client_email : invoice.telephone1;
        const editButton = canEdit ? `<button class="btn btn-outline-warning" onclick="editInvoice(${invoice.id})" title="Edit Draft">
                        <i class="bi bi-pencil"></i>
                    </button>` : '';
        
        return `
        <tr>
            <td><strong>${invoice.invoice_number}</strong></td>
            <td>${clientInfo}<br><small class="text-muted">${contactInfo}</small></td>
            <td><strong>€${invoice.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>${formatDate(invoice.due_date)}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    ${editButton}
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
        'sent': '<span class="badge bg-info">Sent</span>',
        'paid': '<span class="badge bg-success">Paid</span>',
        'overdue': '<span class="badge bg-danger">Overdue</span>'
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

function resetLineItems() {
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = `
        <div class="line-item-row">
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
        due_date: new Date(document.getElementById('dueDate').value).toISOString(),
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
        
        if (action === 'sent' && !isEditing) {
            setTimeout(() => generatePDF(invoice.id), 500);
        }
    } catch (error) {
        showError(`Error ${editingInvoiceId ? 'updating' : 'creating'} invoice: ` + error.message);
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

The invoice is due on ${formatDate(currentInvoice.due_date)}.

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
    
    document.getElementById('clientName').value = invoice.client_name;
    document.getElementById('companyName').value = invoice.company_name || '';
    document.getElementById('clientEmail').value = invoice.client_email || '';
    document.getElementById('telephone1').value = invoice.telephone1 || '';
    document.getElementById('telephone2').value = invoice.telephone2 || '';
    document.getElementById('clientAddress').value = invoice.client_address || '';
    document.getElementById('dueDate').value = invoice.due_date.split('T')[0];
    document.getElementById('tax').value = invoice.tax || 0;
    document.getElementById('notes').value = invoice.notes || '';
    
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = '';
    
    invoice.line_items.forEach(item => {
        const newItem = document.createElement('div');
        newItem.className = 'line-item-row';
        newItem.innerHTML = `
            <div class="row g-2">
                <div class="col-md-5">
                    <input type="text" class="form-control item-desc" placeholder="Description *" value="${item.description}" required>
                </div>
                <div class="col-md-2">
                    <input type="number" class="form-control item-qty" placeholder="Qty *" min="1" value="${item.quantity}" required>
                </div>
                <div class="col-md-3">
                    <input type="number" class="form-control item-price" placeholder="Unit Price *" step="0.01" value="${item.unit_price}" required>
                </div>
                <div class="col-md-2">
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
        `Are you sure you want to permanently delete invoice ${invoice ? invoice.invoice_number : invoiceId}? This action cannot be undone.`
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

loadInvoices();
