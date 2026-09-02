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

// alert()/confirm() ma con ui-modal invece dei popup nativi del browser
class ModalService {
  private modalElement: HTMLElement | null = null;

  private static readonly CLOSE_ANIMATION_MS = 150;

  private createModal(): HTMLElement {
    if (this.modalElement) {
      this.modalElement.remove();
    }

    const modal = document.createElement('ui-modal');
    document.body.appendChild(modal);
    this.modalElement = modal;
    return modal;
  }

  private setModalAttributes(modal: HTMLElement, attrs: Record<string, string>) {
    Object.entries(attrs).forEach(([key, value]) => {
      modal.setAttribute(key, value);
    });
  }

  private removeModal(modal: HTMLElement) {
    modal.setAttribute('open', 'false');
    setTimeout(() => {
      modal.remove();
      if (this.modalElement === modal) {
        this.modalElement = null;
      }
    }, ModalService.CLOSE_ANIMATION_MS);
  }

  alert(options: ModalOptions | string): Promise<void> {
    return new Promise((resolve) => {
      const modal = this.createModal();

      const opts: ModalOptions =
        typeof options === 'string' ? { title: 'Avviso', message: options } : options;

      this.setModalAttributes(modal, {
        open: 'true',
        title: opts.title,
        message: opts.message,
        variant: opts.variant || 'info',
        'confirm-label': opts.confirmLabel || 'OK',
        'hide-cancel': 'true',
      });

      const handleClose = () => {
        modal.removeEventListener('confirm', handleClose);
        modal.removeEventListener('cancel', handleClose);
        this.removeModal(modal);
        resolve();
      };

      modal.addEventListener('confirm', handleClose);
      modal.addEventListener('cancel', handleClose);
    });
  }

  success(message: string, title = 'Operazione completata'): Promise<void> {
    return this.alert({
      title,
      message,
      variant: 'success',
      confirmLabel: 'OK',
    });
  }

  error(message: string, title = 'Errore'): Promise<void> {
    return this.alert({
      title,
      message,
      variant: 'danger',
      confirmLabel: 'OK',
    });
  }

  confirm(options: ModalOptions | string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = this.createModal();

      const opts: ModalOptions =
        typeof options === 'string'
          ? { title: 'Conferma', message: options, variant: 'danger' }
          : options;

      this.setModalAttributes(modal, {
        open: 'true',
        title: opts.title,
        message: opts.message,
        variant: opts.variant || 'danger',
        'confirm-label': opts.confirmLabel || 'Conferma',
        'cancel-label': opts.cancelLabel || 'Annulla',
      });

      const cleanup = () => {
        modal.removeEventListener('confirm', handleConfirm);
        modal.removeEventListener('cancel', handleCancel);
        this.removeModal(modal);
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
