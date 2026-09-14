import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CompetenceLevel,
  TimePreference,
  CreditTransactionType,
  type User,
  type UserPreferences,
  type CreditTransaction,
} from '@artaround/shared';
import { authService } from '../../services/auth.service';
import { creditService } from '../../services/credit.service';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-alert';
import '../ui/ui-section-header';
import '../ui/ui-icon';
import { __ } from '../../services/i18n.service';

const TOPUP_PRESETS = [5, 10, 20, 50];

const COMPETENCE_LABELS: Record<CompetenceLevel, string> = {
  [CompetenceLevel.INFANTILE]: __('Infantile'),
  [CompetenceLevel.SEMPLICE]: __('Semplice'),
  [CompetenceLevel.MEDIO]: __('Medio'),
  [CompetenceLevel.AVANZATO]: __('Avanzato'),
};

const TIME_LABELS: Record<TimePreference, string> = {
  [TimePreference.VELOCE]: __('Veloce (30-45 min)'),
  [TimePreference.NORMALE]: __('Normale (1-2 ore)'),
  [TimePreference.APPROFONDITO]: __('Approfondito (2+ ore)'),
};

/**
 * Impostazioni account: profilo, password e credito, per qualunque utente loggato.
 */
@customElement('settings-page')
export class SettingsPage extends LitElement {
  @property({ type: Object }) user: User | null = null;

  @state() private email = '';
  @state() private competenceLevel: CompetenceLevel = CompetenceLevel.MEDIO;
  @state() private availableTime: TimePreference = TimePreference.NORMALE;
  @state() private age = '';

  @state() private profileSaving = false;
  @state() private profileError = '';
  @state() private profileSuccess = '';

  @state() private currentPassword = '';
  @state() private newPassword = '';
  @state() private confirmPassword = '';
  @state() private passwordSaving = false;
  @state() private passwordError = '';
  @state() private passwordSuccess = '';

  @state() private customTopUpAmount = '';
  @state() private topUpLoading = false;
  @state() private topUpError = '';
  @state() private topUpSuccess = '';
  @state() private transactions: CreditTransaction[] = [];
  @state() private transactionsLoading = true;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadTransactions();
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('user') && this.user) {
      this.email = this.user.email ?? '';
      const prefs: Partial<UserPreferences> = this.user.preferences ?? {};
      this.competenceLevel = prefs.competenceLevel ?? CompetenceLevel.MEDIO;
      this.availableTime = prefs.availableTime ?? TimePreference.NORMALE;
      this.age = prefs.age !== undefined ? String(prefs.age) : '';
    }
  }

  private async loadTransactions() {
    this.transactionsLoading = true;
    try {
      this.transactions = await creditService.getTransactions();
    } catch {
      // Il saldo resta comunque visibile senza lo storico dei movimenti.
    } finally {
      this.transactionsLoading = false;
    }
  }

  private async handleSaveProfile(e: Event) {
    e.preventDefault();
    this.profileError = '';
    this.profileSuccess = '';
    this.profileSaving = true;

    try {
      const parsedAge = this.age.trim() ? Number(this.age) : undefined;
      if (parsedAge !== undefined && (Number.isNaN(parsedAge) || parsedAge < 0)) {
        this.profileError = __("L'età deve essere un numero valido");
        return;
      }

      const { user, error } = await authService.updateProfile({
        email: this.email.trim() || undefined,
        preferences: {
          competenceLevel: this.competenceLevel,
          availableTime: this.availableTime,
          age: parsedAge,
        },
      });

      if (error || !user) {
        this.profileError = error || __('Aggiornamento non riuscito');
        return;
      }

      this.profileSuccess = __('Profilo aggiornato con successo');
      this.dispatchEvent(
        new CustomEvent('user-updated', { detail: user, bubbles: true, composed: true }),
      );
    } finally {
      this.profileSaving = false;
    }
  }

  private async handleChangePassword(e: Event) {
    e.preventDefault();
    this.passwordError = '';
    this.passwordSuccess = '';

    if (this.newPassword.length < 8) {
      this.passwordError = __('La nuova password deve avere almeno 8 caratteri');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = __('Le password non coincidono');
      return;
    }

    this.passwordSaving = true;
    try {
      const { success, error } = await authService.changePassword(
        this.currentPassword,
        this.newPassword,
      );

      if (!success) {
        this.passwordError = error || __('Cambio password non riuscito');
        return;
      }

      this.passwordSuccess = __('Password cambiata con successo');
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    } finally {
      this.passwordSaving = false;
    }
  }

  // Ricarica simulata: nessun pagamento reale, l'importo scelto viene accreditato subito.
  private async handleTopUp(amount: number) {
    this.topUpError = '';
    this.topUpSuccess = '';

    if (!Number.isFinite(amount) || amount <= 0) {
      this.topUpError = __('Scegli un importo maggiore di zero');
      return;
    }

    this.topUpLoading = true;
    try {
      const { balance, error } = await creditService.topUp(amount);
      if (error) {
        this.topUpError = error;
        return;
      }

      this.topUpSuccess = `${__('Ricarica completata')}: +€${amount.toFixed(2)}`;
      this.customTopUpAmount = '';
      void this.loadTransactions();

      if (this.user) {
        const updatedUser: User = { ...this.user, creditBalance: balance };
        this.dispatchEvent(
          new CustomEvent('user-updated', {
            detail: updatedUser,
            bubbles: true,
            composed: true,
          }),
        );
      }
    } finally {
      this.topUpLoading = false;
    }
  }

  private handleCustomTopUp(e: Event) {
    e.preventDefault();
    const amount = Number(this.customTopUpAmount);
    void this.handleTopUp(amount);
  }

  private formatTransactionDate(value: string | Date): string {
    return new Date(value).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private transactionLabel(transaction: CreditTransaction): string {
    if (transaction.type === CreditTransactionType.TOPUP) {
      return __('Ricarica credito');
    }
    if (transaction.type === CreditTransactionType.EARNING) {
      return transaction.description
        ? `${__('Vendita')}: ${transaction.description}`
        : __('Vendita');
    }
    return transaction.description || __('Acquisto');
  }

  private renderCreditCard() {
    const balance = this.user?.creditBalance ?? 0;

    return html`
      <ui-card padding="lg">
        <ui-section-header
          .title=${__('Credito')}
          .description=${__(
            'Saldo spendibile nel marketplace. Nessun pagamento reale: scegli una cifra e ricaricala.',
          )}
          .help=${__(
            'Il credito è personale: serve per acquistare item e visite di altri autori nel Marketplace, e cresce quando qualcun altro acquista i tuoi. Se il saldo non basta per un acquisto, ricarica il credito qui prima di riprovare.',
          )}
        ></ui-section-header>

        <div class="mt-4 flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-full bg-success-50 dark:bg-surface-800 flex items-center justify-center flex-shrink-0"
          >
            <ui-icon name="euro" class="text-success-600 dark:text-success-500"></ui-icon>
          </div>
          <div>
            <p class="text-2xl font-bold text-surface-900 dark:text-white">
              €${balance.toFixed(2)}
            </p>
            <p class="text-xs text-surface-500 dark:text-surface-400">${__('Saldo disponibile')}</p>
          </div>
        </div>

        ${this.topUpError
          ? html`<ui-alert
              class="block mt-4"
              variant="danger"
              .message=${this.topUpError}
            ></ui-alert>`
          : nothing}
        ${this.topUpSuccess
          ? html`<ui-alert
              class="block mt-4"
              variant="success"
              .message=${this.topUpSuccess}
            ></ui-alert>`
          : nothing}

        <div class="mt-4">
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            ${__('Ricarica')}
          </p>
          <div class="flex flex-wrap gap-2 mb-3">
            ${TOPUP_PRESETS.map(
              (preset) => html`
                <ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  ?loading=${this.topUpLoading}
                  .label=${`€${preset}`}
                  @click=${() => this.handleTopUp(preset)}
                ></ui-button>
              `,
            )}
          </div>

          <form @submit=${this.handleCustomTopUp} class="flex items-end gap-3">
            <ui-input
              type="number"
              .label=${__('Importo personalizzato (€)')}
              .value=${this.customTopUpAmount}
              .placeholder=${'15.50'}
              @input-change=${(e: CustomEvent) => (this.customTopUpAmount = e.detail.value)}
            ></ui-input>
            <ui-button
              type="submit"
              variant="primary"
              size="md"
              ?loading=${this.topUpLoading}
              .label=${__('Ricarica')}
            ></ui-button>
          </form>
        </div>

        ${this.transactionsLoading
          ? nothing
          : this.transactions.length > 0
            ? html`
                <div class="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
                  <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                    ${__('Movimenti recenti')}
                  </p>
                  <div class="space-y-1.5 max-h-56 overflow-y-auto">
                    ${this.transactions.map(
                      (transaction) => html`
                        <div class="flex items-center justify-between text-sm py-1">
                          <div class="min-w-0">
                            <p class="text-surface-700 dark:text-surface-300 truncate">
                              ${this.transactionLabel(transaction)}
                            </p>
                            <p class="text-xs text-surface-400">
                              ${this.formatTransactionDate(transaction.createdAt)}
                            </p>
                          </div>
                          <span
                            class="font-semibold flex-shrink-0 ${transaction.amount >= 0
                              ? 'text-success-600 dark:text-success-500'
                              : 'text-danger-600 dark:text-danger-500'}"
                          >
                            ${transaction.amount >= 0 ? '+' : ''}€${transaction.amount.toFixed(2)}
                          </span>
                        </div>
                      `,
                    )}
                  </div>
                </div>
              `
            : nothing}
      </ui-card>
    `;
  }

  render() {
    return html`
      <div class="max-w-2xl space-y-6">
        <ui-page-header
          .title=${__('Il mio account')}
          .description=${__('Gestisci il tuo profilo e la tua password')}
          .help=${__(
            'Impostazioni personali del tuo utente: credito, profilo e password. Per gestire altri utenti (solo admin) vai invece nella pagina Utenti.',
          )}
        ></ui-page-header>

        ${this.renderCreditCard()}

        <ui-card padding="lg">
          <ui-section-header
            .title=${__('Profilo')}
            .description=${this.user?.username || ''}
            .help=${__(
              'Livello di competenza e tempo a disposizione sono le tue preferenze di default: il Navigator le propone come punto di partenza a ogni nuova visita, ma restano modificabili dal visitatore in ogni momento.',
            )}
          ></ui-section-header>

          <form @submit=${this.handleSaveProfile} class="space-y-4 mt-4">
            ${this.profileError
              ? html`<ui-alert variant="danger" .message=${this.profileError}></ui-alert>`
              : nothing}
            ${this.profileSuccess
              ? html`<ui-alert variant="success" .message=${this.profileSuccess}></ui-alert>`
              : nothing}

            <ui-input
              type="email"
              .label=${__('Email')}
              .value=${this.email}
              required
              @input-change=${(e: CustomEvent) => (this.email = e.detail.value)}
            ></ui-input>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ui-select
                .label=${__('Livello di competenza preferito')}
                .value=${this.competenceLevel}
                .options=${Object.values(CompetenceLevel).map((value) => ({
                  value,
                  label: COMPETENCE_LABELS[value],
                }))}
                @select-change=${(e: CustomEvent) =>
                  (this.competenceLevel = e.detail.value as CompetenceLevel)}
              ></ui-select>

              <ui-select
                .label=${__('Tempo a disposizione preferito')}
                .value=${this.availableTime}
                .options=${Object.values(TimePreference).map((value) => ({
                  value,
                  label: TIME_LABELS[value],
                }))}
                @select-change=${(e: CustomEvent) =>
                  (this.availableTime = e.detail.value as TimePreference)}
              ></ui-select>
            </div>

            <ui-input
              type="number"
              .label=${__('Età (opzionale)')}
              .value=${this.age}
              @input-change=${(e: CustomEvent) => (this.age = e.detail.value)}
            ></ui-input>

            <div class="flex justify-end">
              <ui-button
                type="submit"
                variant="primary"
                ?loading=${this.profileSaving}
                .label=${__('Salva profilo')}
              ></ui-button>
            </div>
          </form>
        </ui-card>

        <ui-card padding="lg">
          <ui-section-header
            .title=${__('Cambia password')}
            .help=${__(
              'Serve la password attuale per confermare il cambio. Dopo il salvataggio resti collegato in questa sessione, ma dovrai usare la nuova password al prossimo accesso.',
            )}
          ></ui-section-header>

          <form @submit=${this.handleChangePassword} class="space-y-4 mt-4">
            ${this.passwordError
              ? html`<ui-alert variant="danger" .message=${this.passwordError}></ui-alert>`
              : nothing}
            ${this.passwordSuccess
              ? html`<ui-alert variant="success" .message=${this.passwordSuccess}></ui-alert>`
              : nothing}

            <ui-input
              type="password"
              .label=${__('Password attuale')}
              .value=${this.currentPassword}
              required
              @input-change=${(e: CustomEvent) => (this.currentPassword = e.detail.value)}
            ></ui-input>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ui-input
                type="password"
                .label=${__('Nuova password')}
                .value=${this.newPassword}
                required
                hint=${__('Almeno 8 caratteri')}
                @input-change=${(e: CustomEvent) => (this.newPassword = e.detail.value)}
              ></ui-input>

              <ui-input
                type="password"
                .label=${__('Conferma nuova password')}
                .value=${this.confirmPassword}
                required
                @input-change=${(e: CustomEvent) => (this.confirmPassword = e.detail.value)}
              ></ui-input>
            </div>

            <div class="flex justify-end">
              <ui-button
                type="submit"
                variant="primary"
                ?loading=${this.passwordSaving}
                .label=${__('Cambia password')}
              ></ui-button>
            </div>
          </form>
        </ui-card>
      </div>
    `;
  }
}
