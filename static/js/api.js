const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function getHeaders(includeAuth = true) {
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (includeAuth) {
        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    return headers;
}

async function handleResponse(response) {
    if (response.status === 401) {
        removeToken();
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.detail || 'Request failed');
    }
    
    return data;
}

const api = {
    async register(email, password, role = 'user') {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify({ email, password, role }),
        });
        return handleResponse(response);
    },
    
    async login(username, password) {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: getHeaders(false),
            body: JSON.stringify({ username, password }),
        });
        const data = await handleResponse(response);
        if (data.access_token) {
            setToken(data.access_token);
        }
        return data;
    },
    
    async getCurrentUser() {
        const response = await fetch(`${API_BASE}/users/me`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async getInvoices() {
        const response = await fetch(`${API_BASE}/invoices`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async getInvoice(id) {
        const response = await fetch(`${API_BASE}/invoices/${id}`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async createInvoice(data) {
        const response = await fetch(`${API_BASE}/invoices`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    
    async updateInvoice(id, data) {
        const response = await fetch(`${API_BASE}/invoices/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    
    async deleteInvoice(id) {
        const response = await fetch(`${API_BASE}/invoices/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (response.status === 204) {
            return { success: true };
        }
        return handleResponse(response);
    },
    
    async cancelInvoice(id, reason) {
        const response = await fetch(`${API_BASE}/invoices/${id}/cancel`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ reason }),
        });
        return handleResponse(response);
    },
    
    async issueInvoice(id) {
        const response = await fetch(`${API_BASE}/invoices/${id}/issue`, {
            method: 'POST',
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async generateInvoicePDF(id) {
        const response = await fetch(`${API_BASE}/invoices/${id}/generate-pdf`, {
            method: 'POST',
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async sendInvoiceEmail(id, recipientEmail, message, subject) {
        const response = await fetch(`${API_BASE}/invoices/${id}/send-email`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ recipient_email: recipientEmail, subject: subject || 'Invoice', message }),
        });
        return handleResponse(response);
    },
    
    async getQuotes() {
        const response = await fetch(`${API_BASE}/quotes`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async getQuote(id) {
        const response = await fetch(`${API_BASE}/quotes/${id}`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async createQuote(data) {
        const response = await fetch(`${API_BASE}/quotes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    
    async updateQuote(id, data) {
        const response = await fetch(`${API_BASE}/quotes/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
    
    async deleteQuote(id) {
        const response = await fetch(`${API_BASE}/quotes/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (response.status === 204) {
            return { success: true };
        }
        return handleResponse(response);
    },
    
    async cancelQuote(id, reason) {
        const response = await fetch(`${API_BASE}/quotes/${id}/cancel`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ reason }),
        });
        return handleResponse(response);
    },
    
    async convertQuoteToInvoice(id) {
        const response = await fetch(`${API_BASE}/quotes/${id}/convert-to-invoice`, {
            method: 'POST',
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async generateQuotePDF(id) {
        const response = await fetch(`${API_BASE}/quotes/${id}/generate-pdf`, {
            method: 'POST',
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async sendQuoteEmail(id, recipientEmail, message, subject) {
        const response = await fetch(`${API_BASE}/quotes/${id}/send-email`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ recipient_email: recipientEmail, subject: subject || 'Quote', message }),
        });
        return handleResponse(response);
    },
    
    async getCustomerEmailHistory(customerId) {
        const response = await fetch(`${API_BASE}/customers/${customerId}/email-history`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
    
    async getAllEmailHistory() {
        const response = await fetch(`${API_BASE}/customers/email-history/all`, {
            headers: getHeaders(),
        });
        return handleResponse(response);
    },
};

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

function logout() {
    removeToken();
    window.location.href = '/login';
}
