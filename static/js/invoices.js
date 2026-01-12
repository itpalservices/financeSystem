if (!checkAuth()) {
    window.location.href = '/login';
}

let invoices = [];
let currentInvoice = null;
let editingInvoiceId = null;
let projects = [];
let currentMilestones = [];
let customers = [];
let customersLoaded = false;
let customersLoadPromise = null;

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

async function loadCustomers() {
    if (customersLoadPromise) return customersLoadPromise;
    
    customersLoadPromise = (async () => {
        try {
            const response = await fetch('/api/customers', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (response.ok) {
                customers = await response.json();
                populateCustomerDropdown();
                customersLoaded = true;
            }
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    })();
    
    return customersLoadPromise;
}

function populateCustomerDropdown() {
    const selects = document.querySelectorAll('#customerSelect, #editCustomerSelect');
    selects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Select Customer --</option>';
        
        customers.filter(c => c.status !== 'inactive').forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            option.textContent = customer.display_name || customer.name || customer.company_name || 'Unknown';
            select.appendChild(option);
        });
        
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

function selectCustomer() {
    const select = document.getElementById('customerSelect');
    const customerId = select.value;
    
    if (!customerId) {
        clearCustomerSelection();
        return;
    }
    
    const customer = customers.find(c => c.id == customerId);
    if (!customer) return;
    
    document.getElementById('selectedCustomerId').value = customer.id;
    showCustomerPreview(customer, 'preview');
    filterProjectsByCustomer(customer.id);
}

function showCustomerPreview(customer, prefix) {
    const previewDiv = document.getElementById('customerPreview');
    if (!previewDiv) return;
    
    previewDiv.style.display = 'block';
    document.getElementById(`${prefix}DisplayName`).textContent = customer.display_name || customer.name || 'Unknown';
    
    const companyDiv = document.getElementById(`${prefix}Company`);
    if (customer.company_name) {
        companyDiv.style.display = 'block';
        companyDiv.querySelector('span').textContent = customer.company_name;
    } else {
        companyDiv.style.display = 'none';
    }
    
    const emailDiv = document.getElementById(`${prefix}Email`);
    if (customer.email) {
        emailDiv.style.display = 'block';
        emailDiv.querySelector('span').textContent = customer.email;
    } else {
        emailDiv.style.display = 'none';
    }
    
    const phoneDiv = document.getElementById(`${prefix}Phone`);
    const phones = [customer.telephone1, customer.telephone2].filter(Boolean).join(' / ');
    if (phones) {
        phoneDiv.style.display = 'block';
        phoneDiv.querySelector('span').textContent = phones;
    } else {
        phoneDiv.style.display = 'none';
    }
    
    const addressDiv = document.getElementById(`${prefix}Address`);
    if (customer.address) {
        addressDiv.style.display = 'block';
        addressDiv.querySelector('span').textContent = customer.address;
    } else {
        addressDiv.style.display = 'none';
    }
    
    const vatDiv = document.getElementById(`${prefix}Vat`);
    if (customer.client_tax_id) {
        vatDiv.style.display = 'block';
        vatDiv.querySelector('span').textContent = customer.client_tax_id;
    } else {
        vatDiv.style.display = 'none';
    }
}

function clearCustomerSelection() {
    document.getElementById('customerSelect').value = '';
    document.getElementById('selectedCustomerId').value = '';
    const previewDiv = document.getElementById('customerPreview');
    if (previewDiv) previewDiv.style.display = 'none';
}

function openAddCustomerModal() {
    document.getElementById('inlineCustomerForm').reset();
    toggleNewCustomerCompanyFields();
    hideCustomerModalError();
    new bootstrap.Modal(document.getElementById('addCustomerModal')).show();
}

function toggleNewCustomerCompanyFields() {
    const customerType = document.getElementById('newCustomerType').value;
    const companyFields = document.getElementById('newCompanyFields');
    if (companyFields) {
        companyFields.style.display = customerType === 'company' ? 'flex' : 'none';
    }
}

function showCustomerModalError(message) {
    let errorDiv = document.getElementById('customerModalError');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'customerModalError';
        errorDiv.className = 'alert alert-danger mb-3';
        const modalBody = document.querySelector('#addCustomerModal .modal-body');
        modalBody.insertBefore(errorDiv, modalBody.firstChild);
    }
    errorDiv.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${message}`;
    errorDiv.style.display = 'block';
}

function hideCustomerModalError() {
    const errorDiv = document.getElementById('customerModalError');
    if (errorDiv) errorDiv.style.display = 'none';
}

function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('is-invalid');
    let feedback = field.parentElement.querySelector('.invalid-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'invalid-feedback';
        field.parentElement.appendChild(feedback);
    }
    feedback.textContent = message;
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.remove('is-invalid');
    const feedback = field.parentElement.querySelector('.invalid-feedback');
    if (feedback) feedback.textContent = '';
}

function clearAllFieldErrors() {
    ['newDisplayName', 'newEmail', 'newTelephone1', 'newTelephone2'].forEach(clearFieldError);
}

function validateCyprusPhone(phone) {
    if (!phone) return true;
    const pattern = /^(25|22|24|23|99|95|94|96|97)\d{6}$/;
    return pattern.test(phone);
}

function validateEmail(email) {
    if (!email) return true;
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

async function saveNewCustomer() {
    hideCustomerModalError();
    clearAllFieldErrors();
    
    const displayName = document.getElementById('newDisplayName').value.trim();
    const customerType = document.getElementById('newCustomerType').value;
    const email = document.getElementById('newEmail').value.trim();
    const telephone1 = document.getElementById('newTelephone1').value.trim();
    const telephone2 = document.getElementById('newTelephone2').value.trim();
    
    let hasErrors = false;
    
    if (!displayName) {
        setFieldError('newDisplayName', 'Display Name is required');
        hasErrors = true;
    }
    
    if (!email) {
        setFieldError('newEmail', 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        setFieldError('newEmail', 'Invalid email format');
        hasErrors = true;
    }
    
    if (!telephone1) {
        setFieldError('newTelephone1', 'Telephone 1 is required');
        hasErrors = true;
    } else if (!validateCyprusPhone(telephone1)) {
        setFieldError('newTelephone1', 'Must be 8 digits starting with 25, 22, 24, 23, 99, 95, 94, 96, or 97');
        hasErrors = true;
    }
    
    if (telephone2 && !validateCyprusPhone(telephone2)) {
        setFieldError('newTelephone2', 'Must be a valid Cyprus number');
        hasErrors = true;
    }
    
    if (hasErrors) {
        return;
    }
    
    const duplicateResult = await CustomerUtils.validateAndCheckDuplicates(
        'newTelephone1', 
        customerType === 'company' ? 'newClientTaxId' : null,
        customerType === 'company' ? 'newClientRegNo' : null,
        'newEmail'
    );
    if (!duplicateResult.proceed) {
        return;
    }
    
    const customerData = {
        customer_type: customerType.toLowerCase(),
        display_name: displayName,
        status: 'potential',
        name: document.getElementById('newContactName').value.trim() || null,
        company_name: customerType === 'company' ? (document.getElementById('newCompanyName').value.trim() || null) : null,
        email: email || null,
        telephone1: telephone1 || null,
        telephone2: telephone2 || null,
        client_tax_id: customerType === 'company' ? (document.getElementById('newClientTaxId').value.trim() || null) : null,
        client_reg_no: customerType === 'company' ? (document.getElementById('newClientRegNo')?.value.trim() || null) : null,
        address: document.getElementById('newAddress').value.trim() || null
    };
    
    try {
        const response = await fetch('/api/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(customerData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create customer');
        }
        
        const newCustomer = await response.json();
        
        customers.push(newCustomer);
        populateCustomerDropdown();
        
        document.getElementById('customerSelect').value = newCustomer.id;
        selectCustomer();
        
        bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
        showSuccess('Customer created and selected!');
    } catch (error) {
        showCustomerModalError('Error creating customer: ' + error.message);
    }
}

function filterProjectsByCustomer(customerId) {
    const projectSelect = document.getElementById('projectId');
    const milestoneSelect = document.getElementById('milestoneId');
    const summaryPanel = document.getElementById('milestoneSummaryPanel');
    
    if (!projectSelect) return;
    
    projectSelect.innerHTML = '<option value="">No Project</option>';
    projectSelect.value = '';
    
    if (milestoneSelect) {
        milestoneSelect.innerHTML = '<option value="">Select Project First</option>';
        milestoneSelect.disabled = true;
    }
    if (summaryPanel) {
        summaryPanel.style.display = 'none';
    }
    currentMilestones = [];
    
    if (!projects.length || !customerId) return;
    
    const filteredProjects = projects.filter(p => p.customer_id == customerId);
    
    filteredProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.dataset.customerId = project.customer_id;
        option.textContent = `${project.project_code} - ${project.title}`;
        projectSelect.appendChild(option);
    });
    
    if (filteredProjects.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.disabled = true;
        option.textContent = '(No projects for this customer)';
        projectSelect.appendChild(option);
    }
}

let allInvoices = [];

function renderInvoices(invoicesToRender = invoices) {
    const tbody = document.getElementById('invoicesTable');
    
    if (invoicesToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No invoices found</td></tr>';
        return;
    }
    
    tbody.innerHTML = invoicesToRender.map(invoice => {
        const statusBadge = getStatusBadge(invoice.status);
        const pdfButtonText = invoice.pdf_url ? 'Preview PDF' : 'Generate PDF';
        const pdfButtonIcon = invoice.pdf_url ? 'bi-eye' : 'bi-file-pdf';
        const canEdit = invoice.status === 'draft';
        const isIssued = invoice.status === 'issued';
        const isCancelled = invoice.status === 'cancelled';
        
        const editButton = canEdit ? `<button class="btn btn-outline-warning" onclick="editInvoice(${invoice.id})" title="Edit Draft">
                        <i class="bi bi-pencil"></i>
                    </button>` : '';
        const markIssuedButton = canEdit ? `<button class="btn btn-outline-info" onclick="markAsIssued(${invoice.id})" title="Mark as Issued">
                        <i class="bi bi-check-circle"></i>
                    </button>` : '';
        
        const deleteButton = canEdit ? `<button class="btn btn-outline-danger" onclick="deleteInvoice(${invoice.id})" title="Delete Draft">
                        <i class="bi bi-trash"></i>
                    </button>` : '';
        
        const cancelButton = isIssued ? `<button class="btn btn-outline-danger" onclick="openCancelModal(${invoice.id})" title="Cancel Invoice">
                        <i class="bi bi-x-circle"></i>
                    </button>` : '';
        
        const cancelledInfo = isCancelled && invoice.cancel_reason ? `<small class="text-muted d-block">Reason: ${invoice.cancel_reason}</small>` : '';
        
        const projectInfo = invoice.project_id ? `<a href="/projects" class="text-decoration-none"><i class="bi bi-folder"></i></a>` : '-';
        
        return `
        <tr class="${isCancelled ? 'table-secondary' : ''}">
            <td><strong>${invoice.invoice_number}</strong>${cancelledInfo}</td>
            <td>${invoice.client_name || '-'}</td>
            <td>${invoice.company_name || '-'}</td>
            <td>${invoice.telephone1 || '-'}</td>
            <td>${projectInfo}</td>
            <td><strong>€${invoice.total.toFixed(2)}</strong></td>
            <td>${statusBadge}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    ${editButton}
                    ${markIssuedButton}
                    <button class="btn btn-outline-primary" onclick="generatePDF(${invoice.id})" title="${isCancelled ? 'View Cancelled PDF' : pdfButtonText}">
                        <i class="bi ${pdfButtonIcon}"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="openEmailModal(${invoice.id})" title="Send Email" ${isCancelled ? 'disabled' : ''}>
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
        'cancelled': '<span class="badge bg-danger">Cancelled</span>'
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
    
    const customerId = document.getElementById('selectedCustomerId')?.value;
    
    if (!customerId) {
        showModalError('Please select a customer');
        return;
    }
    
    const customer = customers.find(c => c.id == customerId);
    
    const projectId = document.getElementById('projectId')?.value;
    const milestoneId = document.getElementById('milestoneId')?.value;
    
    const data = {
        customer_id: parseInt(customerId),
        client_name: customer?.name || customer?.display_name || null,
        company_name: customer?.company_name || null,
        client_email: customer?.email || null,
        telephone1: customer?.telephone1 || null,
        telephone2: customer?.telephone2 || null,
        client_address: customer?.address || null,
        client_reg_no: customer?.client_reg_no || null,
        client_tax_id: customer?.client_tax_id || null,
        discount: parseFloat(document.getElementById('discount').value) || 0,
        tax: parseFloat(document.getElementById('tax').value) || 0,
        notes: document.getElementById('notes').value,
        status: action,
        line_items: lineItems,
        project_id: projectId ? parseInt(projectId) : null,
        milestone_id: milestoneId ? parseInt(milestoneId) : null
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
    document.getElementById('emailSubject').value = `Invoice ${currentInvoice.invoice_number} from IT PAL Technology Solutions`;
    document.getElementById('emailBody').value = `Dear ${currentInvoice.client_name},

Please find attached invoice ${currentInvoice.invoice_number} for the amount of €${currentInvoice.total.toFixed(2)}.

If you have any questions, please don't hesitate to contact us.

Best regards,
IT PAL Technology Solutions Ltd`;
    
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
    
    await loadCustomers();
    
    editingInvoiceId = invoiceId;
    
    document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-pencil"></i> Edit Draft Invoice';
    document.getElementById('markIssuedModalBtn').style.display = 'inline-block';
    document.getElementById('submitBtnText').textContent = 'Save';
    document.getElementById('submitBtnIcon').className = 'bi bi-check-lg';
    
    if (invoice.customer_id) {
        document.getElementById('customerSelect').value = invoice.customer_id;
        document.getElementById('selectedCustomerId').value = invoice.customer_id;
        const customer = customers.find(c => c.id == invoice.customer_id);
        if (customer) {
            showCustomerPreview(customer, 'preview');
            filterProjectsByCustomer(customer.id);
        }
    } else {
        clearCustomerSelection();
    }
    
    document.getElementById('discount').value = invoice.discount || 0;
    document.getElementById('tax').value = invoice.tax || 0;
    document.getElementById('notes').value = invoice.notes || '';
    
    // Set project and milestone values
    if (document.getElementById('projectId')) {
        document.getElementById('projectId').value = invoice.project_id || '';
        if (invoice.project_id) {
            loadProjectMilestones().then(() => {
                if (invoice.milestone_id && document.getElementById('milestoneId')) {
                    document.getElementById('milestoneId').value = invoice.milestone_id;
                }
            });
        } else {
            document.getElementById('milestoneId').value = '';
            document.getElementById('milestoneId').disabled = true;
        }
    }
    
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
        document.getElementById('submitBtnText').textContent = 'Create';
        document.getElementById('submitBtnIcon').className = 'bi bi-plus-circle';
        editingInvoiceId = null;
        document.getElementById('createForm').reset();
        clearCustomerSelection();
        resetLineItems();
        if (document.getElementById('projectId')) {
            document.getElementById('projectId').value = '';
            document.getElementById('milestoneId').value = '';
            document.getElementById('milestoneId').disabled = true;
        }
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

function openCancelModal(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showError('Invoice not found');
        return;
    }
    
    document.getElementById('cancelInvoiceId').value = invoiceId;
    document.getElementById('cancelInvoiceNumber').textContent = invoice.invoice_number;
    document.getElementById('cancelReasonSelect').value = '';
    document.getElementById('otherReasonText').value = '';
    document.getElementById('otherReasonContainer').style.display = 'none';
    
    const modal = new bootstrap.Modal(document.getElementById('cancelModal'));
    modal.show();
}

document.getElementById('confirmCancelBtn').addEventListener('click', async function() {
    const invoiceId = parseInt(document.getElementById('cancelInvoiceId').value);
    const selectValue = document.getElementById('cancelReasonSelect').value;
    const otherText = document.getElementById('otherReasonText').value.trim();
    
    if (!selectValue) {
        showError('Please select a reason for cancelling the invoice');
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
        await api.cancelInvoice(invoiceId, reason);
        showSuccess('Invoice cancelled successfully');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('cancelModal'));
        modal.hide();
        
        loadInvoices();
    } catch (error) {
        showError('Error cancelling invoice: ' + error.message);
    }
});

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
        await api.issueInvoice(invoiceId);
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
               (invoice.client_name && invoice.client_name.toLowerCase().includes(searchTerm)) ||
               (invoice.company_name && invoice.company_name.toLowerCase().includes(searchTerm)) ||
               (invoice.telephone1 && invoice.telephone1.includes(searchTerm));
    });
    
    renderInvoices(filteredInvoices);
});

async function loadProjects() {
    try {
        const response = await fetch('/api/projects/search/dropdown', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            projects = await response.json();
            populateProjectDropdown();
        }
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function populateProjectDropdown() {
    const projectSelect = document.getElementById('projectId');
    if (!projectSelect) return;
    
    projectSelect.innerHTML = '<option value="">No Project</option>';
    projects.forEach(project => {
        const customerName = project.company_name || project.customer_name || '';
        projectSelect.innerHTML += `<option value="${project.id}" data-customer-tel="${project.customer_telephone || ''}">${project.project_code} - ${project.title} (${customerName})</option>`;
    });
}

async function loadProjectMilestones() {
    const projectId = document.getElementById('projectId').value;
    const milestoneSelect = document.getElementById('milestoneId');
    const projectWarning = document.getElementById('projectWarning');
    const milestoneWarning = document.getElementById('milestoneWarning');
    const summaryPanel = document.getElementById('milestoneSummaryPanel');
    
    projectWarning.style.display = 'none';
    milestoneWarning.style.display = 'none';
    if (summaryPanel) summaryPanel.style.display = 'none';
    
    if (!projectId) {
        milestoneSelect.innerHTML = '<option value="">Select Project First</option>';
        milestoneSelect.disabled = true;
        currentMilestones = [];
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}/milestones-with-financials`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentMilestones = data.milestones || [];
            window.currentProjectCode = data.project_code;
            window.currentProjectTitle = data.project_title;
            
            milestoneSelect.innerHTML = '<option value="">No Milestone</option>';
            currentMilestones.forEach(m => {
                const remaining = m.remaining_amount || (m.expected_amount - (m.received_amount || 0));
                const label = m.milestone_no ? `${m.milestone_no}. ${m.label}` : m.label;
                milestoneSelect.innerHTML += `<option value="${m.id}" data-expected="${m.expected_amount}" data-invoiced="${m.invoiced_amount || 0}" data-received="${m.received_amount || 0}" data-remaining="${remaining}" data-label="${m.label}">${label} (Expected: €${m.expected_amount.toFixed(2)}, Remaining: €${remaining.toFixed(2)})</option>`;
            });
            milestoneSelect.disabled = false;
        }
    } catch (error) {
        console.error('Error loading milestones:', error);
        milestoneSelect.innerHTML = '<option value="">Error loading milestones</option>';
    }
}

async function showMilestoneSummary() {
    const milestoneSelect = document.getElementById('milestoneId');
    const summaryPanel = document.getElementById('milestoneSummaryPanel');
    const milestoneWarning = document.getElementById('milestoneWarning');
    
    if (!milestoneSelect || !milestoneSelect.value) {
        if (summaryPanel) summaryPanel.style.display = 'none';
        if (milestoneWarning) milestoneWarning.style.display = 'none';
        return;
    }
    
    const selectedOption = milestoneSelect.options[milestoneSelect.selectedIndex];
    const expected = parseFloat(selectedOption.dataset.expected) || 0;
    const invoiced = parseFloat(selectedOption.dataset.invoiced) || 0;
    const received = parseFloat(selectedOption.dataset.received) || 0;
    const remaining = parseFloat(selectedOption.dataset.remaining) || 0;
    const label = selectedOption.dataset.label || 'Milestone';
    
    document.getElementById('milestoneSummaryLabel').textContent = label;
    document.getElementById('milestoneSummaryExpected').textContent = `€${expected.toFixed(2)}`;
    document.getElementById('milestoneSummaryInvoiced').textContent = `€${invoiced.toFixed(2)}`;
    document.getElementById('milestoneSummaryReceived').textContent = `€${received.toFixed(2)}`;
    document.getElementById('milestoneSummaryRemaining').textContent = `€${remaining.toFixed(2)}`;
    
    if (summaryPanel) summaryPanel.style.display = 'block';
    
    checkMilestoneWarning();
}

function addMilestoneLineItem() {
    const milestoneSelect = document.getElementById('milestoneId');
    if (!milestoneSelect || !milestoneSelect.value) {
        showErrorToast('Please select a milestone first');
        return;
    }
    
    const selectedOption = milestoneSelect.options[milestoneSelect.selectedIndex];
    const remaining = parseFloat(selectedOption.dataset.remaining) || 0;
    const label = selectedOption.dataset.label || 'Milestone Payment';
    const projectCode = window.currentProjectCode || '';
    
    const description = projectCode ? `${projectCode} - ${label}` : label;
    
    addLineItem();
    
    const lineItems = document.querySelectorAll('.line-item-row');
    const lastItem = lineItems[lineItems.length - 1];
    
    if (lastItem) {
        lastItem.querySelector('.item-desc').value = description;
        lastItem.querySelector('.item-qty').value = 1;
        lastItem.querySelector('.item-price').value = remaining.toFixed(2);
        lastItem.querySelector('.item-discount').value = 0;
    }
    
    checkMilestoneWarning();
}

function checkMilestoneWarning() {
    const milestoneSelect = document.getElementById('milestoneId');
    const milestoneWarning = document.getElementById('milestoneWarning');
    
    if (!milestoneSelect || !milestoneSelect.value) {
        milestoneWarning.style.display = 'none';
        return;
    }
    
    const selectedOption = milestoneSelect.options[milestoneSelect.selectedIndex];
    const expectedAmount = parseFloat(selectedOption.dataset.expected) || 0;
    
    const lineItems = document.querySelectorAll('.line-item-row');
    let subtotal = 0;
    lineItems.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const discount = parseFloat(row.querySelector('.item-discount').value) || 0;
        subtotal += qty * price * (1 - discount / 100);
    });
    
    const overallDiscount = parseFloat(document.getElementById('discount').value) || 0;
    const tax = parseFloat(document.getElementById('tax').value) || 0;
    const afterDiscount = subtotal * (1 - overallDiscount / 100);
    const total = afterDiscount * (1 + tax / 100);
    
    if (expectedAmount > 0 && Math.abs(total - expectedAmount) > 0.01) {
        milestoneWarning.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Invoice total (€${total.toFixed(2)}) differs from milestone expected amount (€${expectedAmount.toFixed(2)})`;
        milestoneWarning.style.display = 'block';
    } else {
        milestoneWarning.style.display = 'none';
    }
}

function clearInvoiceModalState() {
    hideModalError();
    
    const projectWarning = document.getElementById('projectWarning');
    const milestoneWarning = document.getElementById('milestoneWarning');
    const summaryPanel = document.getElementById('milestoneSummaryPanel');
    
    if (projectWarning) projectWarning.style.display = 'none';
    if (milestoneWarning) milestoneWarning.style.display = 'none';
    if (summaryPanel) summaryPanel.style.display = 'none';
    
    document.getElementById('createForm').reset();
    clearCustomerSelection();
    resetLineItems();
    
    const projectSelect = document.getElementById('projectId');
    const milestoneSelect = document.getElementById('milestoneId');
    
    if (projectSelect) projectSelect.value = '';
    if (milestoneSelect) {
        milestoneSelect.value = '';
        milestoneSelect.disabled = true;
        milestoneSelect.innerHTML = '<option value="">Select Project First</option>';
    }
    
    currentMilestones = [];
    editingInvoiceId = null;
    
    document.querySelector('#createModal .modal-title').innerHTML = '<i class="bi bi-file-earmark-plus"></i> Create Invoice';
    document.getElementById('markIssuedModalBtn').style.display = 'none';
    document.getElementById('submitBtnText').textContent = 'Create';
    document.getElementById('submitBtnIcon').className = 'bi bi-plus-circle';
}

document.getElementById('createModal').addEventListener('show.bs.modal', function(event) {
    if (event.relatedTarget && event.relatedTarget.hasAttribute('data-bs-toggle')) {
        const createModal = document.getElementById('createModal');
        createModal.addEventListener('hidden.bs.modal', function onHidden() {
            clearInvoiceModalState();
            createModal.removeEventListener('hidden.bs.modal', onHidden);
        }, { once: true });
    }
});

loadInvoices();
loadProjects();
loadCustomers();
