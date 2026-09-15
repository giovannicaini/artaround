/*
 * File: /src/services/modal.service.ts                                                  *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 02/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

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
 * Modali di alert/conferma pilotati via Promise, senza montare <ui-modal> a mano in ogni pagina.
 */
class ModalService {
  private modalElement: HTMLElement | null = null;

  private static readonly CLOSE_ANIMATION_MS = 150;

  private createModal(): HTMLElement {
    // Rimuove il modal esistente se presente
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

  // Mostra un modal di alert (come alert() ma con stile) Restituisce una promise che si risolve alla chiusura
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

  // Mostra un modal di conferma (come confirm() ma con stile) Restituisce una promise che si risolve in true/false
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
