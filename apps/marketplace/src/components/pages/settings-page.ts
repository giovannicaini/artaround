import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CompetenceLevel,
  TimePreference,
  type User,
  type UserPreferences,
} from '@artaround/shared';
import { authService } from '../../services/auth.service';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-alert';
import '../ui/ui-section-header';
import { __ } from '../../services/i18n.service';

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
 * Pagina "Impostazioni": self-service profilo + password per QUALSIASI utente
 * loggato (a differenza di users-page.ts, che è la gestione utenti riservata
 * agli admin). Usa PUT /api/auth/me e /api/auth/me/password, non
 * PUT /api/users/:id (che richiede ruolo admin).
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

  createRenderRoot() {
    return this;
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

  render() {
    return html`
      <div class="max-w-2xl space-y-6">
        <ui-page-header
          .title=${__('Il mio account')}
          .description=${__('Gestisci il tuo profilo e la tua password')}
        ></ui-page-header>

        <ui-card padding="lg">
          <ui-section-header
            .title=${__('Profilo')}
            .description=${this.user?.username || ''}
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
          <ui-section-header .title=${__('Cambia password')}></ui-section-header>

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
