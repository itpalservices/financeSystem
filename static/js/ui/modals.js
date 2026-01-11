const ModalUtils = {
    errorModalHtml: `
        <div class="modal fade" id="globalErrorModal" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-danger">
                    <div class="modal-header bg-danger bg-opacity-25">
                        <h5 class="modal-title text-danger" id="errorModalTitle">
                            <i class="bi bi-x-circle me-2"></i>Error
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="errorModalBody">
                        An error occurred.
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger" data-bs-dismiss="modal" id="errorModalClose">OK</button>
                    </div>
                </div>
            </div>
        </div>
    `,

    successModalHtml: `
        <div class="modal fade" id="globalSuccessModal" tabindex="-1" aria-hidden="true" style="z-index: 1060;">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-success">
                    <div class="modal-header bg-success bg-opacity-25">
                        <h5 class="modal-title text-success" id="successModalTitle">
                            <i class="bi bi-check-circle me-2"></i>Success
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="successModalBody">
                        Operation completed successfully.
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-success" data-bs-dismiss="modal" id="successModalClose">OK</button>
                    </div>
                </div>
            </div>
        </div>
    `,

    confirmModalHtml: `
        <div class="modal fade" id="globalConfirmModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="confirmModalTitle">Confirm</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="confirmModalBody">
                        Are you sure?
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="confirmModalCancel">Cancel</button>
                        <button type="button" class="btn btn-primary" id="confirmModalConfirm">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    `,

    warningModalHtml: `
        <div class="modal fade" id="globalWarningModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-warning">
                    <div class="modal-header bg-warning bg-opacity-25">
                        <h5 class="modal-title text-warning" id="warningModalTitle">
                            <i class="bi bi-exclamation-triangle me-2"></i>Warning
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="warningModalBody">
                        Warning message
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="warningModalCancel">Cancel</button>
                        <button type="button" class="btn btn-warning" id="warningModalProceed">Proceed Anyway</button>
                    </div>
                </div>
            </div>
        </div>
    `,

    deleteModalHtml: `
        <div class="modal fade" id="globalDeleteModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-danger">
                    <div class="modal-header bg-danger bg-opacity-25">
                        <h5 class="modal-title text-danger" id="deleteModalTitle">
                            <i class="bi bi-trash me-2"></i>Confirm Delete
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body" id="deleteModalBody">
                        Are you sure you want to delete this item?
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="deleteModalCancel">Cancel</button>
                        <button type="button" class="btn btn-danger" id="deleteModalConfirm">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `,

    init() {
        if (!document.getElementById('globalErrorModal')) {
            document.body.insertAdjacentHTML('beforeend', this.errorModalHtml);
        }
        if (!document.getElementById('globalSuccessModal')) {
            document.body.insertAdjacentHTML('beforeend', this.successModalHtml);
        }
        if (!document.getElementById('globalConfirmModal')) {
            document.body.insertAdjacentHTML('beforeend', this.confirmModalHtml);
        }
        if (!document.getElementById('globalWarningModal')) {
            document.body.insertAdjacentHTML('beforeend', this.warningModalHtml);
        }
        if (!document.getElementById('globalDeleteModal')) {
            document.body.insertAdjacentHTML('beforeend', this.deleteModalHtml);
        }
    },

    showError(title, message) {
        this.init();
        return new Promise((resolve) => {
            const modal = document.getElementById('globalErrorModal');
            const modalInstance = new bootstrap.Modal(modal, { backdrop: 'static' });
            
            document.getElementById('errorModalTitle').innerHTML = `<i class="bi bi-x-circle me-2"></i>${title}`;
            document.getElementById('errorModalBody').innerHTML = message;
            
            const closeBtn = document.getElementById('errorModalClose');
            
            const cleanup = () => {
                closeBtn.replaceWith(closeBtn.cloneNode(true));
                modal.removeEventListener('hidden.bs.modal', onHidden);
            };
            
            const onHidden = () => {
                cleanup();
                resolve();
            };
            
            modal.addEventListener('hidden.bs.modal', onHidden, { once: true });
            
            modalInstance.show();
        });
    },

    showSuccess(title, message) {
        this.init();
        return new Promise((resolve) => {
            const modal = document.getElementById('globalSuccessModal');
            const modalInstance = new bootstrap.Modal(modal);
            
            document.getElementById('successModalTitle').innerHTML = `<i class="bi bi-check-circle me-2"></i>${title}`;
            document.getElementById('successModalBody').innerHTML = message;
            
            const closeBtn = document.getElementById('successModalClose');
            
            const cleanup = () => {
                closeBtn.replaceWith(closeBtn.cloneNode(true));
                modal.removeEventListener('hidden.bs.modal', onHidden);
            };
            
            const onHidden = () => {
                cleanup();
                resolve();
            };
            
            modal.addEventListener('hidden.bs.modal', onHidden, { once: true });
            
            modalInstance.show();
            
            setTimeout(() => {
                if (modal.classList.contains('show')) {
                    modalInstance.hide();
                }
            }, 3000);
        });
    },

    showConfirm(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        this.init();
        return new Promise((resolve) => {
            const modal = document.getElementById('globalConfirmModal');
            const modalInstance = new bootstrap.Modal(modal);
            
            document.getElementById('confirmModalTitle').textContent = title;
            document.getElementById('confirmModalBody').innerHTML = message;
            document.getElementById('confirmModalConfirm').textContent = confirmText;
            document.getElementById('confirmModalCancel').textContent = cancelText;
            
            const confirmBtn = document.getElementById('confirmModalConfirm');
            const cancelBtn = document.getElementById('confirmModalCancel');
            
            const cleanup = () => {
                confirmBtn.replaceWith(confirmBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                modal.removeEventListener('hidden.bs.modal', onHidden);
            };
            
            const onHidden = () => {
                cleanup();
                resolve(false);
            };
            
            modal.addEventListener('hidden.bs.modal', onHidden, { once: true });
            
            document.getElementById('confirmModalConfirm').addEventListener('click', () => {
                modal.removeEventListener('hidden.bs.modal', onHidden);
                modalInstance.hide();
                cleanup();
                resolve(true);
            }, { once: true });
            
            modalInstance.show();
        });
    },

    showWarning(title, message, proceedText = 'Proceed Anyway', cancelText = 'Cancel') {
        this.init();
        return new Promise((resolve) => {
            const modal = document.getElementById('globalWarningModal');
            const modalInstance = new bootstrap.Modal(modal);
            
            document.getElementById('warningModalTitle').innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>${title}`;
            document.getElementById('warningModalBody').innerHTML = message;
            document.getElementById('warningModalProceed').textContent = proceedText;
            document.getElementById('warningModalCancel').textContent = cancelText;
            
            const proceedBtn = document.getElementById('warningModalProceed');
            const cancelBtn = document.getElementById('warningModalCancel');
            
            const cleanup = () => {
                proceedBtn.replaceWith(proceedBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                modal.removeEventListener('hidden.bs.modal', onHidden);
            };
            
            const onHidden = () => {
                cleanup();
                resolve(false);
            };
            
            modal.addEventListener('hidden.bs.modal', onHidden, { once: true });
            
            document.getElementById('warningModalProceed').addEventListener('click', () => {
                modal.removeEventListener('hidden.bs.modal', onHidden);
                modalInstance.hide();
                cleanup();
                resolve(true);
            }, { once: true });
            
            modalInstance.show();
        });
    },

    showDelete(title, message, deleteText = 'Delete', cancelText = 'Cancel') {
        this.init();
        return new Promise((resolve) => {
            const modal = document.getElementById('globalDeleteModal');
            const modalInstance = new bootstrap.Modal(modal);
            
            document.getElementById('deleteModalTitle').innerHTML = `<i class="bi bi-trash me-2"></i>${title}`;
            document.getElementById('deleteModalBody').innerHTML = message;
            document.getElementById('deleteModalConfirm').textContent = deleteText;
            document.getElementById('deleteModalCancel').textContent = cancelText;
            
            const confirmBtn = document.getElementById('deleteModalConfirm');
            const cancelBtn = document.getElementById('deleteModalCancel');
            
            const cleanup = () => {
                confirmBtn.replaceWith(confirmBtn.cloneNode(true));
                cancelBtn.replaceWith(cancelBtn.cloneNode(true));
                modal.removeEventListener('hidden.bs.modal', onHidden);
            };
            
            const onHidden = () => {
                cleanup();
                resolve(false);
            };
            
            modal.addEventListener('hidden.bs.modal', onHidden, { once: true });
            
            document.getElementById('deleteModalConfirm').addEventListener('click', () => {
                modal.removeEventListener('hidden.bs.modal', onHidden);
                modalInstance.hide();
                cleanup();
                resolve(true);
            }, { once: true });
            
            modalInstance.show();
        });
    }
};

window.ModalUtils = ModalUtils;
