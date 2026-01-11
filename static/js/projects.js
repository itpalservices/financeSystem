let projects = [];
let customers = [];

document.addEventListener('DOMContentLoaded', function() {
    loadProjects();
    loadCustomers();
    
    document.getElementById('searchInput').addEventListener('input', debounce(loadProjects, 300));
    document.getElementById('statusFilter').addEventListener('change', loadProjects);
});

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

async function loadProjects() {
    const searchTerm = document.getElementById('searchInput').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    try {
        let url = `/api/projects?search=${encodeURIComponent(searchTerm)}`;
        if (statusFilter) {
            url += `&status_filter=${statusFilter}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Failed to load projects');
        }
        
        projects = await response.json();
        renderProjects();
    } catch (error) {
        showError(error.message);
    }
}

async function loadCustomers() {
    try {
        const response = await fetch('/api/customers', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (response.ok) {
            customers = await response.json();
            populateCustomerDropdowns();
        }
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

function populateCustomerDropdowns() {
    const createSelect = document.getElementById('createCustomerId');
    const editSelect = document.getElementById('editCustomerId');
    
    const options = customers
        .filter(c => c.status !== 'inactive')
        .map(c => `<option value="${c.id}">${c.display_name || c.name || c.company_name || 'Unknown'}</option>`)
        .join('');
    
    if (createSelect) {
        const currentCreate = createSelect.value;
        createSelect.innerHTML = '<option value="">-- Select Customer --</option>' + options;
        if (currentCreate) createSelect.value = currentCreate;
    }
    if (editSelect) {
        const currentEdit = editSelect.value;
        editSelect.innerHTML = '<option value="">-- Select Customer --</option>' + options;
        if (currentEdit) editSelect.value = currentEdit;
    }
}

function selectCustomer() {
    const select = document.getElementById('createCustomerId');
    const customerId = select.value;
    
    if (!customerId) {
        clearCustomerSelection();
        return;
    }
    
    const customer = customers.find(c => c.id == customerId);
    if (!customer) return;
    
    showCustomerPreview(customer);
}

function showCustomerPreview(customer) {
    const previewDiv = document.getElementById('customerPreview');
    if (!previewDiv) return;
    
    previewDiv.style.display = 'block';
    document.getElementById('previewDisplayName').textContent = customer.display_name || customer.name || 'Unknown';
    
    const companyDiv = document.getElementById('previewCompany');
    if (companyDiv) {
        if (customer.company_name) {
            companyDiv.style.display = 'block';
            companyDiv.querySelector('span').textContent = customer.company_name;
        } else {
            companyDiv.style.display = 'none';
        }
    }
    
    const emailDiv = document.getElementById('previewEmail');
    if (emailDiv) {
        if (customer.email) {
            emailDiv.style.display = 'block';
            emailDiv.querySelector('span').textContent = customer.email;
        } else {
            emailDiv.style.display = 'none';
        }
    }
    
    const phoneDiv = document.getElementById('previewPhone');
    if (phoneDiv) {
        const phones = [customer.telephone1, customer.telephone2].filter(Boolean).join(' / ');
        if (phones) {
            phoneDiv.style.display = 'block';
            phoneDiv.querySelector('span').textContent = phones;
        } else {
            phoneDiv.style.display = 'none';
        }
    }
}

function clearCustomerSelection() {
    document.getElementById('createCustomerId').value = '';
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
    
    const customerData = {
        customer_type: customerType.toLowerCase(),
        display_name: displayName,
        status: 'potential',
        name: document.getElementById('newContactName').value.trim() || null,
        company_name: customerType === 'company' ? (document.getElementById('newCompanyName').value.trim() || null) : null,
        email: email || null,
        telephone1: telephone1 || null,
        telephone2: telephone2 || null,
        address: document.getElementById('newAddress').value.trim() || null,
        client_tax_id: customerType === 'company' ? (document.getElementById('newClientTaxId').value.trim() || null) : null,
        client_reg_no: customerType === 'company' ? (document.getElementById('newClientRegNo').value.trim() || null) : null
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
            let errorMsg = 'Failed to create customer';
            if (error.detail) {
                if (typeof error.detail === 'string') {
                    errorMsg = error.detail;
                } else if (Array.isArray(error.detail)) {
                    errorMsg = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                }
            }
            showCustomerModalError(errorMsg);
            return;
        }
        
        const newCustomer = await response.json();
        
        bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
        
        await loadCustomers();
        
        document.getElementById('createCustomerId').value = newCustomer.id;
        selectCustomer();
        
        showSuccess('Customer created and selected');
    } catch (error) {
        showCustomerModalError('Error creating customer: ' + error.message);
    }
}

function renderProjects() {
    const tbody = document.getElementById('projectsTable');
    
    if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No projects found</td></tr>';
        return;
    }
    
    tbody.innerHTML = projects.map(project => {
        const progressPercent = project.total_budget > 0 
            ? Math.min(100, (project.invoiced_amount / project.total_budget) * 100) 
            : 0;
        
        const statusBadge = getStatusBadge(project.status);
        const customerDisplay = project.company_name || project.customer_name || '-';
        
        return `
            <tr>
                <td><strong>${project.project_code}</strong></td>
                <td>${escapeHtml(project.title)}</td>
                <td>${escapeHtml(customerDisplay)}</td>
                <td>&euro;${project.total_budget.toFixed(2)}</td>
                <td>&euro;${project.invoiced_amount.toFixed(2)}</td>
                <td style="min-width: 120px;">
                    <div class="progress">
                        <div class="progress-bar bg-success" role="progressbar" style="width: ${progressPercent}%">
                            ${progressPercent.toFixed(0)}%
                        </div>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewProject(${project.id})" title="View">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editProject(${project.id})" title="Edit">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteProject(${project.id})" title="Delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusBadge(status) {
    const badges = {
        'active': '<span class="badge bg-success">Active</span>',
        'closed': '<span class="badge bg-secondary">Closed</span>',
        'cancelled': '<span class="badge bg-danger">Cancelled</span>'
    };
    return badges[status] || `<span class="badge bg-info">${status}</span>`;
}

function addCreateMilestone() {
    const container = document.getElementById('createMilestones');
    const index = container.children.length + 1;
    
    const milestoneHtml = `
        <div class="milestone-item" id="createMilestone${index}">
            <div class="row">
                <div class="col-md-4">
                    <label class="form-label">Type</label>
                    <select class="form-select form-select-sm milestone-type">
                        <option value="">Select...</option>
                        <option value="advance">Advance Payment</option>
                        <option value="progress">Progress Payment</option>
                        <option value="final">Final Payment</option>
                    </select>
                </div>
                <div class="col-md-3">
                    <label class="form-label">Amount</label>
                    <input type="number" class="form-control form-control-sm milestone-amount" step="0.01" value="0">
                </div>
                <div class="col-md-4">
                    <label class="form-label">Due Date</label>
                    <input type="date" class="form-control form-control-sm milestone-due-date">
                </div>
                <div class="col-md-1 d-flex align-items-end">
                    <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeCreateMilestone(${index})">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', milestoneHtml);
}

function removeCreateMilestone(index) {
    const element = document.getElementById(`createMilestone${index}`);
    if (element) element.remove();
}

async function createProject() {
    const customerId = document.getElementById('createCustomerId').value;
    const title = document.getElementById('createTitle').value;
    
    if (!customerId || !title) {
        showError('Customer and Title are required');
        return;
    }
    
    const milestones = [];
    document.querySelectorAll('#createMilestones .milestone-item').forEach(item => {
        const type = item.querySelector('.milestone-type').value;
        const amount = item.querySelector('.milestone-amount').value;
        const dueDate = item.querySelector('.milestone-due-date').value;
        
        if (type) {
            milestones.push({
                milestone_type: type,
                expected_amount: parseFloat(amount) || 0,
                due_date: dueDate ? new Date(dueDate).toISOString() : null
            });
        }
    });
    
    const startDate = document.getElementById('createStartDate').value;
    const endDate = document.getElementById('createEndDate').value;
    
    const data = {
        customer_id: parseInt(customerId),
        title: title,
        description: document.getElementById('createDescription').value || null,
        total_budget: parseFloat(document.getElementById('createBudget').value) || 0,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        notes: document.getElementById('createNotes').value || null,
        milestones: milestones.length > 0 ? milestones : null
    };
    
    try {
        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            let errorMsg = 'Failed to create project';
            if (error.detail) {
                if (Array.isArray(error.detail)) {
                    errorMsg = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                } else {
                    errorMsg = error.detail;
                }
            }
            throw new Error(errorMsg);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('createModal')).hide();
        document.getElementById('createForm').reset();
        document.getElementById('createMilestones').innerHTML = '';
        showSuccess('Project created successfully');
        loadProjects();
    } catch (error) {
        showError(error.message);
    }
}

async function viewProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/summary`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load project');
        
        const data = await response.json();
        renderProjectView(data);
        new bootstrap.Modal(document.getElementById('viewModal')).show();
    } catch (error) {
        showError(error.message);
    }
}

function renderProjectView(data) {
    const project = data.project;
    const customer = data.customer;
    const financial = data.financial;
    const milestones = data.milestones;
    
    const statusBadge = getStatusBadge(project.status);
    const progressPercent = financial.progress_percent.toFixed(1);
    
    let milestonesHtml = '';
    if (milestones.length > 0) {
        milestonesHtml = milestones.map(m => {
            const mStatus = getMilestoneStatusBadge(m.status);
            const mProgress = m.expected_amount > 0 
                ? ((m.invoiced_amount / m.expected_amount) * 100).toFixed(0) 
                : 0;
            
            return `
                <div class="milestone-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${m.milestone_no}. ${escapeHtml(m.label)}</strong>
                            ${m.due_date ? `<small class="text-muted ms-2">Due: ${new Date(m.due_date).toLocaleDateString()}</small>` : ''}
                        </div>
                        <div>${mStatus}</div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-4">
                            <small class="text-muted">Expected:</small> &euro;${m.expected_amount.toFixed(2)}
                        </div>
                        <div class="col-md-4">
                            <small class="text-muted">Invoiced:</small> &euro;${m.invoiced_amount.toFixed(2)}
                        </div>
                        <div class="col-md-4">
                            <small class="text-muted">Invoices:</small> ${m.invoices_count}
                        </div>
                    </div>
                    <div class="progress mt-2" style="height: 8px;">
                        <div class="progress-bar bg-info" role="progressbar" style="width: ${mProgress}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        milestonesHtml = '<p class="text-muted">No milestones defined</p>';
    }
    
    document.getElementById('viewModalBody').innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h5>${project.project_code} ${statusBadge}</h5>
                <h4>${escapeHtml(project.title)}</h4>
                ${project.description ? `<p class="text-muted">${escapeHtml(project.description)}</p>` : ''}
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-body">
                        <h6><i class="bi bi-person"></i> Customer</h6>
                        <p class="mb-1"><strong>${customer.name || '-'}</strong></p>
                        ${customer.company_name ? `<p class="mb-1">${customer.company_name}</p>` : ''}
                        ${customer.email ? `<p class="mb-1"><i class="bi bi-envelope"></i> ${customer.email}</p>` : ''}
                        ${customer.telephone1 ? `<p class="mb-0"><i class="bi bi-telephone"></i> ${customer.telephone1}</p>` : ''}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="card bg-light">
                    <div class="card-body">
                        <div class="row text-center">
                            <div class="col-md-3">
                                <h6 class="text-muted">Total Budget</h6>
                                <h4>&euro;${financial.total_budget.toFixed(2)}</h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted">Invoiced</h6>
                                <h4 class="text-success">&euro;${financial.invoiced_total.toFixed(2)}</h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted">Remaining</h6>
                                <h4 class="text-warning">&euro;${financial.remaining.toFixed(2)}</h4>
                            </div>
                            <div class="col-md-3">
                                <h6 class="text-muted">Progress</h6>
                                <h4>${progressPercent}%</h4>
                            </div>
                        </div>
                        <div class="progress mt-3">
                            <div class="progress-bar bg-success" role="progressbar" style="width: ${progressPercent}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-md-12">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5><i class="bi bi-flag"></i> Milestones</h5>
                    <button class="btn btn-sm btn-outline-primary" onclick="openMilestoneModal(${project.id})">
                        <i class="bi bi-plus"></i> Add Milestone
                    </button>
                </div>
                ${milestonesHtml}
            </div>
        </div>
        
        ${project.start_date || project.end_date ? `
        <div class="row mt-4">
            <div class="col-md-12">
                <h5><i class="bi bi-calendar"></i> Timeline</h5>
                <p>
                    ${project.start_date ? `<strong>Start:</strong> ${new Date(project.start_date).toLocaleDateString()}` : ''}
                    ${project.start_date && project.end_date ? ' - ' : ''}
                    ${project.end_date ? `<strong>End:</strong> ${new Date(project.end_date).toLocaleDateString()}` : ''}
                </p>
            </div>
        </div>
        ` : ''}
        
        ${project.notes ? `
        <div class="row mt-4">
            <div class="col-md-12">
                <h5><i class="bi bi-sticky"></i> Notes</h5>
                <p>${escapeHtml(project.notes)}</p>
            </div>
        </div>
        ` : ''}
    `;
}

function getMilestoneStatusBadge(status) {
    const badges = {
        'planned': '<span class="badge bg-secondary">Planned</span>',
        'invoiced': '<span class="badge bg-primary">Invoiced</span>',
        'paid': '<span class="badge bg-success">Paid</span>'
    };
    return badges[status] || `<span class="badge bg-info">${status}</span>`;
}

function openMilestoneModal(projectId) {
    document.getElementById('milestoneProjectId').value = projectId;
    document.getElementById('milestoneForm').reset();
    new bootstrap.Modal(document.getElementById('milestoneModal')).show();
}

async function addMilestoneToProject() {
    const projectId = document.getElementById('milestoneProjectId').value;
    const milestoneType = document.getElementById('milestoneType').value;
    const dueDate = document.getElementById('milestoneDueDate').value;
    
    if (!milestoneType) {
        showError('Please select a milestone type');
        return;
    }
    
    const data = {
        milestone_type: milestoneType,
        expected_amount: parseFloat(document.getElementById('milestoneAmount').value) || 0,
        due_date: dueDate ? new Date(dueDate).toISOString() : null
    };
    
    try {
        const response = await fetch(`/api/projects/${projectId}/milestones`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            let errorMsg = 'Failed to add milestone';
            if (error.detail) {
                if (Array.isArray(error.detail)) {
                    errorMsg = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                } else {
                    errorMsg = error.detail;
                }
            }
            throw new Error(errorMsg);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('milestoneModal')).hide();
        bootstrap.Modal.getInstance(document.getElementById('viewModal')).hide();
        showSuccess('Milestone added successfully');
        viewProject(projectId);
    } catch (error) {
        showError(error.message);
    }
}

async function editProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) throw new Error('Failed to load project');
        
        const project = await response.json();
        
        document.getElementById('editProjectId').value = project.id;
        document.getElementById('editProjectCode').value = project.project_code;
        document.getElementById('editCustomerId').value = project.customer_id;
        document.getElementById('editTitle').value = project.title;
        document.getElementById('editDescription').value = project.description || '';
        document.getElementById('editBudget').value = project.total_budget;
        document.getElementById('editStatus').value = project.status;
        document.getElementById('editStartDate').value = project.start_date ? project.start_date.split('T')[0] : '';
        document.getElementById('editEndDate').value = project.end_date ? project.end_date.split('T')[0] : '';
        document.getElementById('editNotes').value = project.notes || '';
        
        new bootstrap.Modal(document.getElementById('editModal')).show();
    } catch (error) {
        showError(error.message);
    }
}

async function updateProject() {
    const projectId = document.getElementById('editProjectId').value;
    const startDate = document.getElementById('editStartDate').value;
    const endDate = document.getElementById('editEndDate').value;
    
    const data = {
        customer_id: parseInt(document.getElementById('editCustomerId').value),
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDescription').value || null,
        total_budget: parseFloat(document.getElementById('editBudget').value) || 0,
        status: document.getElementById('editStatus').value,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        end_date: endDate ? new Date(endDate).toISOString() : null,
        notes: document.getElementById('editNotes').value || null
    };
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const error = await response.json();
            let errorMsg = 'Failed to update project';
            if (error.detail) {
                if (Array.isArray(error.detail)) {
                    errorMsg = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                } else {
                    errorMsg = error.detail;
                }
            }
            throw new Error(errorMsg);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
        showSuccess('Project updated successfully');
        loadProjects();
    } catch (error) {
        showError(error.message);
    }
}

function deleteProject(projectId) {
    document.getElementById('deleteProjectId').value = projectId;
    new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
    const projectId = document.getElementById('deleteProjectId').value;
    
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        
        if (!response.ok) {
            const error = await response.json();
            let errorMsg = 'Failed to delete project';
            if (error.detail) {
                if (Array.isArray(error.detail)) {
                    errorMsg = error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                } else {
                    errorMsg = error.detail;
                }
            }
            throw new Error(errorMsg);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
        showSuccess('Project deleted successfully');
        loadProjects();
    } catch (error) {
        showError(error.message);
    }
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
