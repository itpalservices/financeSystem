let allReceipts = [];
let allCustomers = [];
let allInvoices = [];
let allProjects = [];

document.addEventListener('DOMContentLoaded', function() {
    loadReceipts();
    loadCustomers();
    loadInvoices();
    loadProjects();
    
    document.getElementById('searchInput').addEventListener('input', filterReceipts);
});

async function loadReceipts() {
    try {
        const response = await fetch('/api/receipts/', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load receipts');
        
        allReceipts = await response.json();
        displayReceipts(allReceipts);
    } catch (error) {
        showError(error.message);
    }
}

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load customers');
        
        allCustomers = await response.json();
        populateCustomerDropdown();
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

async function loadInvoices() {
    try {
        const response = await fetch('/api/invoices/', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load invoices');
        
        allInvoices = await response.json();
    } catch (error) {
        console.error('Error loading invoices:', error);
    }
}

async function loadProjects() {
    try {
        const response = await fetch('/api/projects/', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load projects');
        
        allProjects = await response.json();
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function populateCustomerDropdown() {
    const select = document.getElementById('createCustomerId');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Select Customer --</option>';
    
    allCustomers.filter(c => c.status !== 'inactive').forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.display_name || customer.name || customer.company_name || 'Unknown';
        select.appendChild(option);
    });
    
    if (currentValue) {
        select.value = currentValue;
    }
}

function selectCustomer() {
    const customerId = document.getElementById('createCustomerId').value;
    const previewDiv = document.getElementById('customerPreview');
    
    if (!customerId) {
        if (previewDiv) previewDiv.style.display = 'none';
        return;
    }
    
    const customer = allCustomers.find(c => c.id == customerId);
    if (!customer) {
        if (previewDiv) previewDiv.style.display = 'none';
        return;
    }
    
    document.getElementById('previewDisplayName').textContent = customer.display_name || customer.name || 'N/A';
    document.getElementById('previewCompanyName').textContent = customer.company_name || '';
    document.getElementById('previewEmail').textContent = customer.email || 'No email';
    document.getElementById('previewPhone').textContent = customer.telephone1 || 'No phone';
    previewDiv.style.display = 'block';
    
    filterInvoicesByCustomer(customerId);
    filterProjectsByCustomer(customerId);
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
    
    const duplicateResult = await CustomerUtils.validateAndCheckDuplicates('newTelephone1', customerType === 'company' ? 'newClientTaxId' : null);
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
        
        allCustomers.push(newCustomer);
        populateCustomerDropdown();
        
        document.getElementById('createCustomerId').value = newCustomer.id;
        selectCustomer();
        
        bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
        showSuccess('Customer created and selected!');
    } catch (error) {
        showCustomerModalError('Error creating customer: ' + error.message);
    }
}

function filterInvoicesByCustomer(customerId) {
    const select = document.getElementById('createInvoiceId');
    select.innerHTML = '<option value="">No Invoice Link</option>';
    
    const customer = allCustomers.find(c => c.id == customerId);
    if (!customer) return;
    
    const customerInvoices = allInvoices.filter(inv => 
        inv.telephone1 === customer.telephone1 || inv.customer_id == customerId
    );
    
    customerInvoices.forEach(invoice => {
        const option = document.createElement('option');
        option.value = invoice.id;
        option.textContent = `${invoice.invoice_number} - ${formatCurrency(invoice.total)}`;
        select.appendChild(option);
    });
}

function filterProjectsByCustomer(customerId) {
    const select = document.getElementById('createProjectId');
    select.innerHTML = '<option value="">No Project Link</option>';
    
    const customerProjects = allProjects.filter(p => p.customer_id == customerId);
    
    customerProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = `${project.project_code} - ${project.title}`;
        select.appendChild(option);
    });
}

function displayReceipts(receipts) {
    const tbody = document.getElementById('receiptsTable');
    
    if (receipts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No receipts found</td></tr>';
        return;
    }
    
    tbody.innerHTML = receipts.map(receipt => `
        <tr class="${receipt.status === 'cancelled' ? 'cancelled-row' : ''}">
            <td><strong>${escapeHtml(receipt.receipt_number)}</strong></td>
            <td>${formatDate(receipt.receipt_date)}</td>
            <td>
                ${receipt.company_name ? `<strong>${escapeHtml(receipt.company_name)}</strong><br>` : ''}
                ${escapeHtml(receipt.client_name || '')}
            </td>
            <td>${formatPaymentMethod(receipt.payment_method)}</td>
            <td><strong>${formatCurrency(receipt.amount)}</strong></td>
            <td>${getStatusBadge(receipt.status)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewReceipt(${receipt.id})" title="View">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${receipt.status === 'draft' ? `
                        <button class="btn btn-outline-success" onclick="issueReceipt(${receipt.id})" title="Issue">
                            <i class="bi bi-check-circle"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteReceipt(${receipt.id})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                    ${receipt.status === 'issued' ? `
                        <button class="btn btn-outline-warning" onclick="openCancelModal(${receipt.id})" title="Cancel">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function filterReceipts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = allReceipts.filter(receipt => 
        receipt.receipt_number.toLowerCase().includes(searchTerm) ||
        (receipt.client_name && receipt.client_name.toLowerCase().includes(searchTerm)) ||
        (receipt.company_name && receipt.company_name.toLowerCase().includes(searchTerm)) ||
        (receipt.telephone1 && receipt.telephone1.includes(searchTerm))
    );
    
    displayReceipts(filtered);
}

async function createReceipt() {
    const customerId = document.getElementById('createCustomerId').value;
    const amount = document.getElementById('createAmount').value;
    
    if (!customerId) {
        showError('Please select a customer');
        return;
    }
    
    if (!amount || amount <= 0) {
        showError('Please enter a valid amount');
        return;
    }
    
    const receiptDate = document.getElementById('createReceiptDate').value;
    const invoiceId = document.getElementById('createInvoiceId').value;
    const projectId = document.getElementById('createProjectId').value;
    
    const data = {
        customer_id: parseInt(customerId),
        amount: parseFloat(amount),
        payment_method: document.getElementById('createPaymentMethod').value,
        payment_reference: document.getElementById('createPaymentReference').value || null,
        notes: document.getElementById('createNotes').value || null,
        receipt_date: receiptDate ? new Date(receiptDate).toISOString() : null,
        invoice_id: invoiceId ? parseInt(invoiceId) : null,
        project_id: projectId ? parseInt(projectId) : null,
        context_type: projectId ? 'project' : 'none'
    };
    
    try {
        const response = await fetch('/api/receipts/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create receipt');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('createModal')).hide();
        document.getElementById('createForm').reset();
        showSuccess('Receipt created successfully');
        loadReceipts();
    } catch (error) {
        showError(error.message);
    }
}

async function viewReceipt(receiptId) {
    try {
        const response = await fetch(`/api/receipts/${receiptId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load receipt');
        
        const receipt = await response.json();
        
        document.getElementById('viewModalBody').innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h5>Receipt Information</h5>
                    <table class="table table-sm">
                        <tr><th>Receipt #</th><td>${escapeHtml(receipt.receipt_number)}</td></tr>
                        <tr><th>Date</th><td>${formatDate(receipt.receipt_date)}</td></tr>
                        <tr><th>Status</th><td>${getStatusBadge(receipt.status)}</td></tr>
                        <tr><th>Amount</th><td><strong>${formatCurrency(receipt.amount)}</strong></td></tr>
                        <tr><th>Payment Method</th><td>${formatPaymentMethod(receipt.payment_method)}</td></tr>
                        ${receipt.payment_reference ? `<tr><th>Reference</th><td>${escapeHtml(receipt.payment_reference)}</td></tr>` : ''}
                    </table>
                </div>
                <div class="col-md-6">
                    <h5>Customer Details</h5>
                    <table class="table table-sm">
                        ${receipt.company_name ? `<tr><th>Company</th><td>${escapeHtml(receipt.company_name)}</td></tr>` : ''}
                        ${receipt.client_name ? `<tr><th>Name</th><td>${escapeHtml(receipt.client_name)}</td></tr>` : ''}
                        ${receipt.telephone1 ? `<tr><th>Telephone</th><td>${escapeHtml(receipt.telephone1)}</td></tr>` : ''}
                        ${receipt.client_email ? `<tr><th>Email</th><td>${escapeHtml(receipt.client_email)}</td></tr>` : ''}
                    </table>
                </div>
            </div>
            ${receipt.notes ? `
                <div class="mt-3">
                    <h6>Notes</h6>
                    <p class="text-muted">${escapeHtml(receipt.notes)}</p>
                </div>
            ` : ''}
            ${receipt.status === 'cancelled' ? `
                <div class="alert alert-danger mt-3">
                    <strong>Cancelled:</strong> ${escapeHtml(receipt.cancel_reason || 'No reason provided')}
                    <br><small>Cancelled at: ${formatDateTime(receipt.cancelled_at)}</small>
                </div>
            ` : ''}
        `;
        
        new bootstrap.Modal(document.getElementById('viewModal')).show();
    } catch (error) {
        showError(error.message);
    }
}

async function issueReceipt(receiptId) {
    if (!confirm('Issue this receipt? Once issued, it cannot be edited.')) return;
    
    try {
        const response = await fetch(`/api/receipts/${receiptId}/issue`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to issue receipt');
        }
        
        showSuccess('Receipt issued successfully');
        loadReceipts();
    } catch (error) {
        showError(error.message);
    }
}

function openCancelModal(receiptId) {
    document.getElementById('cancelReceiptId').value = receiptId;
    document.getElementById('cancelReason').value = '';
    new bootstrap.Modal(document.getElementById('cancelModal')).show();
}

async function confirmCancel() {
    const receiptId = document.getElementById('cancelReceiptId').value;
    const reason = document.getElementById('cancelReason').value;
    
    if (!reason.trim()) {
        showError('Please provide a reason for cancellation');
        return;
    }
    
    try {
        const response = await fetch(`/api/receipts/${receiptId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ reason: reason })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to cancel receipt');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('cancelModal')).hide();
        showSuccess('Receipt cancelled successfully');
        loadReceipts();
    } catch (error) {
        showError(error.message);
    }
}

async function deleteReceipt(receiptId) {
    if (!confirm('Delete this draft receipt? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`/api/receipts/${receiptId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete receipt');
        }
        
        showSuccess('Receipt deleted successfully');
        loadReceipts();
    } catch (error) {
        showError(error.message);
    }
}

function getStatusBadge(status) {
    const badges = {
        'draft': '<span class="badge bg-secondary">Draft</span>',
        'issued': '<span class="badge bg-success">Issued</span>',
        'cancelled': '<span class="badge bg-danger">Cancelled</span>'
    };
    return badges[status] || `<span class="badge bg-info">${status}</span>`;
}

function formatPaymentMethod(method) {
    const methods = {
        'cash': 'Cash',
        'bank_transfer': 'Bank Transfer',
        'card': 'Card',
        'cheque': 'Cheque',
        'other': 'Other'
    };
    return methods[method] || method;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-CY', { style: 'currency', currency: 'EUR' }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-GB');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
}
