import '../components/ui/ui-modal';

type ModalVariant = 'default' | 'danger' | 'success' | 'info';

interface ModalOptions {
  title: string;
  message: string;
  variant?: ModalVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
}

/**
 * Modal Service
 * Provides methods similar to alert() and confirm() but using ui-modal component
 */
class ModalService {
  private modalElement: HTMLElement | null = null;

  private createModal(): HTMLElement {
    // Remove existing modal if any
    if (this.modalElement) {
      this.modalElement.remove();
    }

    const modal = document.createElement('ui-modal');
    document.body.appendChild(modal);
    this.modalElement = modal;
    return modal;
  }

  /**
   * Show an alert modal (like alert() but styled)
   * Returns a promise that resolves when closed
   */
  alert(options: ModalOptions | string): Promise<void> {
    return new Promise((resolve) => {
      const modal = this.createModal();

      const opts: ModalOptions =
        typeof options === 'string' ? { title: 'Avviso', message: options } : options;

      modal.setAttribute('open', 'true');
      modal.setAttribute('title', opts.title);
      modal.setAttribute('message', opts.message);
      modal.setAttribute('variant', opts.variant || 'info');
      modal.setAttribute('confirm-label', opts.confirmLabel || 'OK');
      modal.setAttribute('hide-cancel', 'true');

      const handleClose = () => {
        modal.setAttribute('open', 'false');
        modal.removeEventListener('confirm', handleClose);
        modal.removeEventListener('cancel', handleClose);
        setTimeout(() => {
          modal.remove();
          this.modalElement = null;
        }, 150);
        resolve();
      };

      modal.addEventListener('confirm', handleClose);
      modal.addEventListener('cancel', handleClose);
    });
  }

  /**
   * Show a success message
   */
  success(message: string, title = 'Operazione completata'): Promise<void> {
    return this.alert({
      title,
      message,
      variant: 'success',
      confirmLabel: 'OK',
    });
  }

  /**
   * Show an error message
   */
  error(message: string, title = 'Errore'): Promise<void> {
    return this.alert({
      title,
      message,
      variant: 'danger',
      confirmLabel: 'OK',
    });
  }

  /**
   * Show a confirm modal (like confirm() but styled)
   * Returns a promise that resolves to true/false
   */
  confirm(options: ModalOptions | string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = this.createModal();

      const opts: ModalOptions =
        typeof options === 'string'
          ? { title: 'Conferma', message: options, variant: 'danger' }
          : options;

      modal.setAttribute('open', 'true');
      modal.setAttribute('title', opts.title);
      modal.setAttribute('message', opts.message);
      modal.setAttribute('variant', opts.variant || 'danger');
      modal.setAttribute('confirm-label', opts.confirmLabel || 'Conferma');
      modal.setAttribute('cancel-label', opts.cancelLabel || 'Annulla');

      const cleanup = () => {
        modal.setAttribute('open', 'false');
        modal.removeEventListener('confirm', handleConfirm);
        modal.removeEventListener('cancel', handleCancel);
        setTimeout(() => {
          modal.remove();
          this.modalElement = null;
        }, 150);
      };

      const handleConfirm = () => {
        cleanup();
        resolve(true);
      };

      const handleCancel = () => {
        cleanup();
        resolve(false);
      };

      modal.addEventListener('confirm', handleConfirm);
      modal.addEventListener('cancel', handleCancel);
    });
  }
}

export const modalService = new ModalService();
