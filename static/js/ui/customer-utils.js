const CustomerUtils = {
    validateCyprusPhone(phone) {
        if (!phone) return true;
        const pattern = /^(25|22|24|23|99|95|94|96|97)\d{6}$/;
        return pattern.test(phone);
    },

    validateEmail(email) {
        if (!email) return true;
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email);
    },

    async checkDuplicates(phone, vatTic, regNo, email, excludeId = null) {
        const params = new URLSearchParams();
        if (phone) params.append('phone', phone);
        if (vatTic) params.append('vat_tic', vatTic);
        if (regNo) params.append('reg_no', regNo);
        if (email) params.append('email', email);
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
        return { warnings: [], errors: [] };
    },

    setFieldWarning(fieldId, message) {
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
    },

    clearFieldWarning(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.classList.remove('border-warning');
        const feedback = field.parentElement.querySelector('.warning-feedback');
        if (feedback) feedback.remove();
    },

    setFieldError(fieldId, message) {
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
    },

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        field.classList.remove('is-invalid');
        const feedback = field.parentElement.querySelector('.invalid-feedback');
        if (feedback) feedback.textContent = '';
    },

    async validateAndCheckDuplicates(phoneFieldId, vatFieldId, regNoFieldId, emailFieldId, excludeId = null) {
        this.clearFieldWarning(phoneFieldId);
        if (vatFieldId) this.clearFieldWarning(vatFieldId);
        if (regNoFieldId) this.clearFieldWarning(regNoFieldId);
        if (emailFieldId) this.clearFieldError(emailFieldId);
        
        const phoneField = document.getElementById(phoneFieldId);
        const vatField = vatFieldId ? document.getElementById(vatFieldId) : null;
        const regNoField = regNoFieldId ? document.getElementById(regNoFieldId) : null;
        const emailField = emailFieldId ? document.getElementById(emailFieldId) : null;
        
        const phone = phoneField ? phoneField.value.trim() : null;
        const vatTic = vatField ? vatField.value.trim() : null;
        const regNo = regNoField ? regNoField.value.trim() : null;
        const email = emailField ? emailField.value.trim() : null;
        
        if (!phone && !vatTic && !regNo && !email) return { proceed: true, warnings: [], errors: [] };
        
        const duplicateCheck = await this.checkDuplicates(phone, vatTic, regNo, email, excludeId);
        
        if (duplicateCheck.errors && duplicateCheck.errors.length > 0) {
            let errorHtml = '<ul class="mb-0">';
            for (const error of duplicateCheck.errors) {
                if (error.field === 'email' && emailFieldId) {
                    this.setFieldError(emailFieldId, error.message);
                }
                errorHtml += `<li>${error.message}</li>`;
            }
            errorHtml += '</ul>';
            
            await ModalUtils.showError(
                'Duplicate Found',
                `<p>Cannot save due to duplicate data:</p>${errorHtml}`
            );
            
            return { proceed: false, warnings: [], errors: duplicateCheck.errors };
        }
        
        if (duplicateCheck.warnings && duplicateCheck.warnings.length > 0) {
            let warningHtml = '<ul class="mb-0">';
            for (const warning of duplicateCheck.warnings) {
                if (warning.field === 'phone' && phoneFieldId) {
                    this.setFieldWarning(phoneFieldId, warning.message);
                } else if (warning.field === 'vat_tic' && vatFieldId) {
                    this.setFieldWarning(vatFieldId, warning.message);
                } else if (warning.field === 'reg_no' && regNoFieldId) {
                    this.setFieldWarning(regNoFieldId, warning.message);
                }
                warningHtml += `<li>${warning.message}</li>`;
            }
            warningHtml += '</ul>';
            
            const proceed = await ModalUtils.showWarning(
                'Possible Duplicate Found',
                `<p>The following potential duplicates were detected:</p>${warningHtml}<p class="mt-3 mb-0">Do you want to continue saving anyway?</p>`,
                'Save Anyway',
                'Cancel'
            );
            
            return { proceed, warnings: duplicateCheck.warnings, errors: [] };
        }
        
        return { proceed: true, warnings: [], errors: [] };
    }
};

window.CustomerUtils = CustomerUtils;
