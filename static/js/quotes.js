if (!checkAuth()) {
    window.location.href = '/login';
}

let quotes = [];

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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No quotes found</td></tr>';
        return;
    }
    
    tbody.innerHTML = quotes.map(quote => `
        <tr>
            <td>${quote.quote_number}</td>
            <td>${quote.client_name}</td>
            <td>$${quote.total.toFixed(2)}</td>
            <td><span class="badge badge-${quote.status}">${quote.status.toUpperCase()}</span></td>
            <td>${new Date(quote.valid_until).toLocaleDateString()}</td>
            <td class="actions">
                ${quote.status !== 'converted' ? `<button class="btn btn-small btn-success" onclick="convertToInvoice(${quote.id})">Convert</button>` : ''}
                <button class="btn btn-small btn-secondary" onclick="generatePDF(${quote.id})">PDF</button>
                <button class="btn btn-small btn-success" onclick="sendEmail(${quote.id})">Email</button>
                <button class="btn btn-small btn-danger" onclick="deleteQuote(${quote.id})">Delete</button>
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
        valid_until: new Date(document.getElementById('validUntil').value).toISOString(),
        tax: parseFloat(document.getElementById('tax').value) || 0,
        notes: document.getElementById('notes').value,
        line_items: lineItems
    };
    
    try {
        await api.createQuote(data);
        showSuccess('Quote created successfully');
        closeCreateModal();
        loadQuotes();
    } catch (error) {
        showError('Error creating quote: ' + error.message);
    }
});

async function convertToInvoice(quoteId) {
    if (!confirm('Convert this quote to an invoice?')) return;
    
    try {
        await api.convertQuoteToInvoice(quoteId);
        showSuccess('Quote converted to invoice successfully');
        loadQuotes();
    } catch (error) {
        showError('Error converting quote: ' + error.message);
    }
}

async function generatePDF(quoteId) {
    try {
        const result = await api.generateQuotePDF(quoteId);
        showSuccess('PDF generated successfully');
        loadQuotes();
    } catch (error) {
        showError('Error generating PDF: ' + error.message);
    }
}

async function sendEmail(quoteId) {
    const email = prompt('Enter recipient email:');
    if (!email) return;
    
    const message = prompt('Enter optional message:');
    
    try {
        await api.sendQuoteEmail(quoteId, email, message);
        showSuccess('Email sent successfully');
        loadQuotes();
    } catch (error) {
        showError('Error sending email: ' + error.message);
    }
}

async function deleteQuote(quoteId) {
    if (!confirm('Are you sure you want to delete this quote?')) return;
    
    try {
        await api.deleteQuote(quoteId);
        showSuccess('Quote deleted successfully');
        loadQuotes();
    } catch (error) {
        showError('Error deleting quote: ' + error.message);
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

loadQuotes();
