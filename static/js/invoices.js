if (!checkAuth()) {
    window.location.href = '/login';
}

let invoices = [];

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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No invoices found</td></tr>';
        return;
    }
    
    tbody.innerHTML = invoices.map(invoice => `
        <tr>
            <td>${invoice.invoice_number}</td>
            <td>${invoice.client_name}</td>
            <td>$${invoice.total.toFixed(2)}</td>
            <td><span class="badge badge-${invoice.status}">${invoice.status.toUpperCase()}</span></td>
            <td>${new Date(invoice.due_date).toLocaleDateString()}</td>
            <td class="actions">
                <button class="btn btn-small btn-secondary" onclick="generatePDF(${invoice.id})">PDF</button>
                <button class="btn btn-small btn-success" onclick="sendEmail(${invoice.id})">Email</button>
                <button class="btn btn-small btn-danger" onclick="deleteInvoice(${invoice.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

function openCreateModal() {
    document.getElementById('createModal').classList.add('active');
}

function closeCreateModal() {
    document.getElementById('createModal').classList.remove('active');
    document.getElementById('createForm').reset();
}

function addLineItem() {
    const lineItems = document.getElementById('lineItems');
    const newItem = document.createElement('div');
    newItem.className = 'line-item';
    newItem.innerHTML = `
        <input type="text" placeholder="Description" class="item-desc" required>
        <input type="number" placeholder="Qty" class="item-qty" step="0.01" required>
        <input type="number" placeholder="Unit Price" class="item-price" step="0.01" required>
        <button type="button" class="btn btn-danger btn-small" onclick="removeLineItem(this)">Remove</button>
    `;
    lineItems.appendChild(newItem);
}

function removeLineItem(button) {
    button.parentElement.remove();
}

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const lineItemsElements = document.querySelectorAll('.line-item');
    const lineItems = Array.from(lineItemsElements).map(item => ({
        description: item.querySelector('.item-desc').value,
        quantity: parseFloat(item.querySelector('.item-qty').value),
        unit_price: parseFloat(item.querySelector('.item-price').value)
    }));
    
    if (lineItems.length === 0) {
        showError('Please add at least one line item');
        return;
    }
    
    const data = {
        client_name: document.getElementById('clientName').value,
        client_email: document.getElementById('clientEmail').value,
        client_address: document.getElementById('clientAddress').value,
        due_date: new Date(document.getElementById('dueDate').value).toISOString(),
        tax: parseFloat(document.getElementById('tax').value) || 0,
        notes: document.getElementById('notes').value,
        line_items: lineItems
    };
    
    try {
        await api.createInvoice(data);
        showSuccess('Invoice created successfully');
        closeCreateModal();
        loadInvoices();
    } catch (error) {
        showError('Error creating invoice: ' + error.message);
    }
});

async function generatePDF(invoiceId) {
    try {
        const result = await api.generateInvoicePDF(invoiceId);
        showSuccess('PDF generated successfully');
        loadInvoices();
    } catch (error) {
        showError('Error generating PDF: ' + error.message);
    }
}

async function sendEmail(invoiceId) {
    const email = prompt('Enter recipient email:');
    if (!email) return;
    
    const message = prompt('Enter optional message:');
    
    try {
        await api.sendInvoiceEmail(invoiceId, email, message);
        showSuccess('Email sent successfully');
        loadInvoices();
    } catch (error) {
        showError('Error sending email: ' + error.message);
    }
}

async function deleteInvoice(invoiceId) {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    try {
        await api.deleteInvoice(invoiceId);
        showSuccess('Invoice deleted successfully');
        loadInvoices();
    } catch (error) {
        showError('Error deleting invoice: ' + error.message);
    }
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
    setTimeout(() => successDiv.style.display = 'none', 5000);
}

loadInvoices();
