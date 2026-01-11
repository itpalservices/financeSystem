if (!checkAuth()) {
    window.location.href = '/login';
}

let customers = [];
let currentStatusFilter = 'active';

function filterCustomers() {
    const statusFilter = document.getElementById('statusFilter');
    currentStatusFilter = statusFilter ? statusFilter.value.toLowerCase() : 'active';
    if (currentStatusFilter === 'all') currentStatusFilter = '';
    const searchQuery = document.getElementById('searchInput').value;
    loadCustomers(searchQuery);
}

function toggleCompanyFields(prefix) {
    const customerType = document.getElementById(`${prefix}CustomerType`).value;
    const companyFields = document.getElementById(`${prefix}CompanyFields`);
    if (companyFields) {
        companyFields.style.display = customerType === 'company' ? 'flex' : 'none';
    }
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

function clearAllCreateFieldErrors() {
    ['createDisplayName', 'createEmail', 'createTelephone1', 'createTelephone2'].forEach(clearFieldError);
}

function clearAllEditFieldErrors() {
    ['editDisplayName', 'editEmail', 'editTelephone1', 'editTelephone2'].forEach(clearFieldError);
}

function setFieldWarning(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.add('border-warning');
    let feedback = field.parentElement.querySelector('.warning-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.className = 'warning-feedback text-warning small mt-1';
        field.parentElement.appendChild(feedback);
    }
    feedback.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${message}`;
}

function clearFieldWarning(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.remove('border-warning');
    const feedback = field.parentElement.querySelector('.warning-feedback');
    if (feedback) feedback.remove();
}

async function checkDuplicates(phone, vatTic, excludeId = null) {
    const params = new URLSearchParams();
    if (phone) params.append('phone', phone);
    if (vatTic) params.append('vat_tic', vatTic);
    if (excludeId) params.append('exclude_id', excludeId);
    
    try {
        const response = await fetch(`/api/customers/check-duplicates?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Duplicate check failed:', error);
    }
    return { warnings: [] };
}

async function loadCustomers(searchQuery = '') {
    try {
        let url = '/api/customers';
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (currentStatusFilter) params.append('status_filter', currentStatusFilter);
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load customers');
        
        customers = await response.json();
        renderCustomers();
    } catch (error) {
        showError('Error loading customers: ' + error.message);
    }
}

function getStatusBadge(status) {
    switch (status) {
        case 'potential': return '<span class="badge bg-info">Potential</span>';
        case 'active': return '<span class="badge bg-success">Active</span>';
        case 'inactive': return '<span class="badge bg-secondary">Inactive</span>';
        default: return '<span class="badge bg-secondary">Unknown</span>';
    }
}

function renderCustomers() {
    const tbody = document.getElementById('customersTable');
    
    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No customers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = customers.map(customer => {
        const statusBadge = getStatusBadge(customer.status);
        const typeBadge = customer.customer_type === 'company' 
            ? '<small class="text-primary"><i class="bi bi-building"></i></small> ' 
            : '<small class="text-secondary"><i class="bi bi-person"></i></small> ';
        const emailInfo = customer.email || '-';
        const phone = customer.telephone1 || '-';
        const displayName = customer.display_name || customer.name || customer.company_name || 'Unknown';
        
        return `
        <tr>
            <td>${typeBadge}<strong>${displayName}</strong></td>
            <td>${customer.company_name || '-'}</td>
            <td>${phone}${customer.telephone2 ? '<br><small class="text-muted">' + customer.telephone2 + '</small>' : ''}</td>
            <td>${emailInfo}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="editCustomer(${customer.id})" title="Edit Customer">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="viewEmailHistory(${customer.id}, '${(displayName || '').replace(/'/g, "\\'")}', '${(customer.company_name || '').replace(/'/g, "\\'")}')">
                        <i class="bi bi-envelope-open"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

async function createCustomer() {
    clearAllCreateFieldErrors();
    
    const displayName = document.getElementById('createDisplayName').value.trim();
    const customerType = document.getElementById('createCustomerType').value;
    const email = document.getElementById('createEmail').value.trim();
    const telephone1 = document.getElementById('createTelephone1').value.trim();
    const telephone2 = document.getElementById('createTelephone2').value.trim();
    
    let hasErrors = false;
    
    if (!displayName) {
        setFieldError('createDisplayName', 'Display Name is required');
        hasErrors = true;
    }
    
    if (!email) {
        setFieldError('createEmail', 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        setFieldError('createEmail', 'Invalid email format');
        hasErrors = true;
    }
    
    if (!telephone1) {
        setFieldError('createTelephone1', 'Telephone 1 is required');
        hasErrors = true;
    } else if (!validateCyprusPhone(telephone1)) {
        setFieldError('createTelephone1', 'Must be 8 digits starting with 25, 22, 24, 23, 99, 95, 94, 96, or 97');
        hasErrors = true;
    }
    
    if (telephone2 && !validateCyprusPhone(telephone2)) {
        setFieldError('createTelephone2', 'Must be a valid Cyprus number');
        hasErrors = true;
    }
    
    if (hasErrors) {
        return null;
    }
    
    CustomerUtils.clearFieldWarning('createTelephone1');
    CustomerUtils.clearFieldWarning('createClientTaxId');
    
    const vatTic = customerType === 'company' ? document.getElementById('createClientTaxId').value.trim() : null;
    
    const duplicateResult = await CustomerUtils.validateAndCheckDuplicates(
        'createTelephone1', 
        customerType === 'company' ? 'createClientTaxId' : null,
        'createEmail'
    );
    
    if (!duplicateResult.proceed) {
        return null;
    }
    
    const customerData = {
        customer_type: customerType.toLowerCase(),
        display_name: displayName,
        status: document.getElementById('createStatus').value.toLowerCase(),
        name: document.getElementById('createName').value.trim() || null,
        company_name: customerType === 'company' ? (document.getElementById('createCompanyName').value.trim() || null) : null,
        email: email || null,
        telephone1: telephone1 || null,
        telephone2: telephone2 || null,
        address: document.getElementById('createAddress').value.trim() || null,
        client_reg_no: customerType === 'company' ? (document.getElementById('createClientRegNo').value.trim() || null) : null,
        client_tax_id: vatTic || null,
        internal_notes: document.getElementById('createInternalNotes').value.trim() || null
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
        showSuccess('Customer created successfully!');
        bootstrap.Modal.getInstance(document.getElementById('createModal')).hide();
        document.getElementById('createForm').reset();
        await loadCustomers();
        
        return newCustomer;
    } catch (error) {
        showError('Error creating customer: ' + error.message);
        return null;
    }
}

async function editCustomer(customerId) {
    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (!response.ok) throw new Error('Failed to load customer');
        
        const customer = await response.json();
        
        document.getElementById('editCustomerId').value = customer.id;
        document.getElementById('editCustomerType').value = customer.customer_type || 'individual';
        document.getElementById('editStatus').value = customer.status || 'potential';
        document.getElementById('editDisplayName').value = customer.display_name || '';
        document.getElementById('editName').value = customer.name || '';
        document.getElementById('editCompanyName').value = customer.company_name || '';
        document.getElementById('editEmail').value = customer.email || '';
        document.getElementById('editTelephone1').value = customer.telephone1 || '';
        document.getElementById('editTelephone2').value = customer.telephone2 || '';
        document.getElementById('editAddress').value = customer.address || '';
        document.getElementById('editClientRegNo').value = customer.client_reg_no || '';
        document.getElementById('editClientTaxId').value = customer.client_tax_id || '';
        document.getElementById('editInternalNotes').value = customer.internal_notes || '';
        
        toggleCompanyFields('edit');
        new bootstrap.Modal(document.getElementById('editModal')).show();
    } catch (error) {
        showError('Error loading customer: ' + error.message);
    }
}

async function updateCustomer() {
    clearAllEditFieldErrors();
    
    const customerId = document.getElementById('editCustomerId').value;
    const displayName = document.getElementById('editDisplayName').value.trim();
    const customerType = document.getElementById('editCustomerType').value;
    const email = document.getElementById('editEmail').value.trim();
    const telephone1 = document.getElementById('editTelephone1').value.trim();
    const telephone2 = document.getElementById('editTelephone2').value.trim();
    
    let hasErrors = false;
    
    if (!displayName) {
        setFieldError('editDisplayName', 'Display Name is required');
        hasErrors = true;
    }
    
    if (!email) {
        setFieldError('editEmail', 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        setFieldError('editEmail', 'Invalid email format');
        hasErrors = true;
    }
    
    if (!telephone1) {
        setFieldError('editTelephone1', 'Telephone 1 is required');
        hasErrors = true;
    } else if (!validateCyprusPhone(telephone1)) {
        setFieldError('editTelephone1', 'Must be 8 digits starting with 25, 22, 24, 23, 99, 95, 94, 96, or 97');
        hasErrors = true;
    }
    
    if (telephone2 && !validateCyprusPhone(telephone2)) {
        setFieldError('editTelephone2', 'Must be a valid Cyprus number');
        hasErrors = true;
    }
    
    if (hasErrors) {
        return;
    }
    
    CustomerUtils.clearFieldWarning('editTelephone1');
    CustomerUtils.clearFieldWarning('editClientTaxId');
    
    const vatTic = customerType === 'company' ? document.getElementById('editClientTaxId').value.trim() : null;
    
    const duplicateResult = await CustomerUtils.validateAndCheckDuplicates(
        'editTelephone1', 
        customerType === 'company' ? 'editClientTaxId' : null,
        'editEmail',
        parseInt(customerId)
    );
    
    if (!duplicateResult.proceed) {
        return;
    }
    
    const customerData = {
        customer_type: customerType.toLowerCase(),
        display_name: displayName,
        status: document.getElementById('editStatus').value.toLowerCase(),
        name: document.getElementById('editName').value.trim() || null,
        company_name: customerType === 'company' ? (document.getElementById('editCompanyName').value.trim() || null) : null,
        email: email || null,
        telephone1: telephone1 || null,
        telephone2: telephone2 || null,
        address: document.getElementById('editAddress').value.trim() || null,
        client_reg_no: customerType === 'company' ? (document.getElementById('editClientRegNo').value.trim() || null) : null,
        client_tax_id: vatTic || null,
        internal_notes: document.getElementById('editInternalNotes').value.trim() || null
    };
    
    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(customerData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update customer');
        }
        
        showSuccess('Customer updated successfully!');
        bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
        await loadCustomers();
    } catch (error) {
        showError('Error updating customer: ' + error.message);
    }
}


function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('success').style.display = 'none';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('success');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('error').style.display = 'none';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 3000);
}

let searchTimeout;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        filterCustomers();
    }, 300);
});

let currentEmailLogs = [];

async function viewEmailHistory(customerId, customerName, companyName) {
    document.getElementById('emailHistoryCustomerName').textContent = 
        companyName ? `${customerName} (${companyName})` : customerName;
    
    const tbody = document.getElementById('emailHistoryTable');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
    
    new bootstrap.Modal(document.getElementById('emailHistoryModal')).show();
    
    try {
        currentEmailLogs = await api.getCustomerEmailHistory(customerId);
        renderEmailHistory();
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading email history</td></tr>';
        showError('Error loading email history: ' + error.message);
    }
}

function renderEmailHistory() {
    const tbody = document.getElementById('emailHistoryTable');
    
    if (currentEmailLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No emails sent to this customer yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = currentEmailLogs.map((log, index) => {
        const sentAt = new Date(log.sent_at);
        const formattedDate = sentAt.toLocaleDateString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const formattedTime = sentAt.toLocaleTimeString('en-GB', {
            hour: '2-digit', minute: '2-digit'
        });
        
        const typeBadge = log.email_type === 'invoice' 
            ? '<span class="badge bg-primary">Invoice</span>'
            : '<span class="badge bg-info">Quote</span>';
        
        const documentNumber = log.document_number || '-';
        const amount = log.total_amount !== null ? `${log.total_amount.toFixed(2)}` : '-';
        
        return `
        <tr>
            <td>${formattedDate}<br><small class="text-muted">${formattedTime}</small></td>
            <td>${typeBadge}</td>
            <td><strong>${documentNumber}</strong></td>
            <td>${log.recipient_email}</td>
            <td><small>${log.subject ? (log.subject.length > 30 ? log.subject.substring(0, 30) + '...' : log.subject) : '-'}</small></td>
            <td>${amount}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewEmailDetail(${index})" title="View Details">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

function viewEmailDetail(index) {
    const log = currentEmailLogs[index];
    
    const sentAt = new Date(log.sent_at);
    const formattedDateTime = sentAt.toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    document.getElementById('detailSentAt').textContent = formattedDateTime;
    document.getElementById('detailDocument').textContent = 
        `${log.email_type.charAt(0).toUpperCase() + log.email_type.slice(1)} ${log.document_number || '-'}`;
    document.getElementById('detailRecipient').textContent = log.recipient_email;
    document.getElementById('detailAmount').textContent = 
        log.total_amount !== null ? `${log.total_amount.toFixed(2)}` : '-';
    document.getElementById('detailSubject').textContent = log.subject || '-';
    document.getElementById('detailMessage').textContent = log.message || 'No message body';
    
    if (log.pdf_url) {
        document.getElementById('detailPdfSection').style.display = 'block';
        document.getElementById('detailPdfLink').href = log.pdf_url;
    } else {
        document.getElementById('detailPdfSection').style.display = 'none';
    }
    
    new bootstrap.Modal(document.getElementById('emailDetailModal')).show();
}

loadCustomers();
