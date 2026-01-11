if (!checkAuth()) {
    window.location.href = '/login';
}

let customers = [];
let currentStatusFilter = 'active';

function filterCustomers() {
    const statusFilter = document.getElementById('statusFilter');
    currentStatusFilter = statusFilter ? statusFilter.value : 'active';
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
                    <button class="btn btn-outline-info" onclick="viewEmailHistory(${customer.id}, '${displayName.replace(/'/g, "\\'")}', '${(customer.company_name || '').replace(/'/g, "\\'")}')">
                        <i class="bi bi-envelope-open"></i>
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
}

async function createCustomer() {
    const displayName = document.getElementById('createDisplayName').value.trim();
    
    if (!displayName) {
        showError('Display Name is required');
        return;
    }
    
    const customerData = {
        customer_type: document.getElementById('createCustomerType').value,
        display_name: displayName,
        status: document.getElementById('createStatus').value,
        name: document.getElementById('createName').value.trim() || null,
        company_name: document.getElementById('createCompanyName').value.trim() || null,
        email: document.getElementById('createEmail').value.trim() || null,
        telephone1: document.getElementById('createTelephone1').value.trim() || null,
        telephone2: document.getElementById('createTelephone2').value.trim() || null,
        address: document.getElementById('createAddress').value.trim() || null,
        client_reg_no: document.getElementById('createClientRegNo').value.trim() || null,
        client_tax_id: document.getElementById('createClientTaxId').value.trim() || null,
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
    const customerId = document.getElementById('editCustomerId').value;
    const displayName = document.getElementById('editDisplayName').value.trim();
    
    if (!displayName) {
        showError('Display Name is required');
        return;
    }
    
    const customerData = {
        customer_type: document.getElementById('editCustomerType').value,
        display_name: displayName,
        status: document.getElementById('editStatus').value,
        name: document.getElementById('editName').value.trim() || null,
        company_name: document.getElementById('editCompanyName').value.trim() || null,
        email: document.getElementById('editEmail').value.trim() || null,
        telephone1: document.getElementById('editTelephone1').value.trim() || null,
        telephone2: document.getElementById('editTelephone2').value.trim() || null,
        address: document.getElementById('editAddress').value.trim() || null,
        client_reg_no: document.getElementById('editClientRegNo').value.trim() || null,
        client_tax_id: document.getElementById('editClientTaxId').value.trim() || null,
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
