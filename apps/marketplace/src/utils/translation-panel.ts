import { html, nothing } from 'lit';
import type { AppLanguage } from '@artaround/shared';
import { __ } from '../services/i18n.service';

export interface TranslationField {
  label: string;
  value: string;
  kind: 'input' | 'textarea';
  rows?: number;
  onUpdate: (value: string) => void;
}

export interface StackedTranslationsOptions {
  targetLanguages: AppLanguage[];
  getLanguageLabel: (language: AppLanguage) => string;
  getTranslationStatus: (language: AppLanguage) => 'ai' | 'manual';
  getFields: (language: AppLanguage) => TranslationField[];
  translating: boolean;
  onTranslateMissing: () => void;
}

/**
 * Riquadro "Traduzioni richieste": una lingua per riquadro, tutte visibili insieme.
 */
export function renderStackedTranslations(options: StackedTranslationsOptions) {
  const {
    targetLanguages,
    getLanguageLabel,
    getTranslationStatus,
    getFields,
    translating,
    onTranslateMissing,
  } = options;

  if (targetLanguages.length === 0) return nothing;

  return html`
    <div class="p-4 rounded-xl border border-surface-200 dark:border-surface-700 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h4 class="text-sm font-semibold text-surface-800 dark:text-surface-100">
          ${__('Traduzioni richieste')} (${targetLanguages.length})
        </h4>
        <ui-button
          type="button"
          size="sm"
          variant="secondary"
          icon="sparkles"
          .label=${__('Traduci mancanti con AI')}
          .loading=${translating}
          @click=${onTranslateMissing}
        ></ui-button>
      </div>

      ${targetLanguages.map(
        (lang) => html`
          <div class="space-y-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-semibold text-surface-600 dark:text-surface-300">
                ${getLanguageLabel(lang)}
              </p>
              <ui-badge
                size="sm"
                variant=${getTranslationStatus(lang) === 'ai' ? 'info' : 'secondary'}
                .label=${getTranslationStatus(lang) === 'ai' ? __('AI') : __('Manuale')}
              ></ui-badge>
            </div>
            ${getFields(lang).map((field) =>
              field.kind === 'textarea'
                ? html`
                    <ui-textarea
                      .label=${field.label}
                      .value=${field.value}
                      rows=${field.rows ?? 4}
                      @textarea-change=${(e: CustomEvent<{ value: string }>) =>
                        field.onUpdate(e.detail.value)}
                      required
                    ></ui-textarea>
                  `
                : html`
                    <ui-input
                      .label=${field.label}
                      .value=${field.value}
                      @input-change=${(e: CustomEvent<{ value: string }>) =>
                        field.onUpdate(e.detail.value)}
                      required
                    ></ui-input>
                  `,
            )}
          </div>
        `,
      )}
    </div>
  `;
}
