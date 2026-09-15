/*
 * File: /src/components/pages/purchases-page.ts                                         *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Item, User, Visit } from '@artaround/shared';
import { marketplaceService } from '../../services/marketplace.service';
import { getLocalizedText } from '../../utils/localized-text';
import { renderMetaRow } from '../../utils/render-meta-row';
import {
  getReferenceTypeLabel,
  getContentDurationLabel,
  getLanguageLevelLabel,
  getLicenseLabel,
} from '../../utils/enum-labels';
import '../ui/ui-page-header';
import '../ui/ui-filter-tabs';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-empty';
import '../ui/ui-data-grid';
import '../ui/ui-media-card';
import '../ui/ui-badge';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';

type PurchaseTab = 'items' | 'visits';

/**
 * I propri acquisti: item e visite comprati nel marketplace.
 */
@customElement('purchases-page')
export class PurchasesPage extends LitElement {
  @property({ type: Object }) user: User | null = null;
  @state() private tab: PurchaseTab = 'items';
  @state() private loading = true;
  @state() private error = '';
  @state() private purchasedItems: Item[] = [];
  @state() private purchasedVisits: Visit[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadPurchases();
  }

  private async loadPurchases() {
    this.loading = true;
    this.error = '';
    try {
      const [items, visits] = await Promise.all([
        marketplaceService.getMyItemPurchases(),
        marketplaceService.getMyVisitPurchases(),
      ]);
      this.purchasedItems = items.map((entry) => entry.item);
      this.purchasedVisits = visits.map((entry) => entry.visit);
    } catch (e) {
      console.error('Error loading purchases:', e);
      this.error = __('Impossibile caricare i tuoi acquisti');
    } finally {
      this.loading = false;
    }
  }

  private renderPurchasedItem(item: Item) {
    const title = getLocalizedText(item.title, item.translatedTitles);
    const text = getLocalizedText(item.text, item.translatedTexts);

    return html`
      <ui-media-card
        .imageSrc=${item.image || ''}
        .imageAlt=${title}
        placeholderType="content"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          html`<ui-badge variant="primary" size="sm" .label=${__('Acquistato')}></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">${title}</h3>
          ${renderMetaRow([
            item.authorName ? `${__('di')} ${item.authorName}` : undefined,
            getReferenceTypeLabel(item.referenceType),
            getContentDurationLabel(item.duration),
            getLanguageLevelLabel(item.languageLevel),
            item.license ? getLicenseLabel(item.license) : undefined,
          ])}
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">${text}</p>
        `}
      ></ui-media-card>
    `;
  }

  private renderPurchasedVisit(visit: Visit) {
    const title = getLocalizedText(visit.title, visit.titleTranslations);
    const description = getLocalizedText(visit.description, visit.descriptionTranslations);
    const levels = visit.targetAudience?.languageLevels || [];

    return html`
      <ui-media-card
        .imageSrc=${visit.coverImage || ''}
        .imageAlt=${title}
        placeholderType="museum"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          html`<ui-badge variant="primary" size="sm" .label=${__('Acquistata')}></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">${title}</h3>
          ${renderMetaRow([
            visit.authorName ? `${__('di')} ${visit.authorName}` : undefined,
            visit.targetAudience?.estimatedDuration
              ? `${visit.targetAudience.estimatedDuration} ${__('min')}`
              : undefined,
            visit.metadata?.artworksCount
              ? `${visit.metadata.artworksCount} ${__('tappe')}`
              : undefined,
            visit.metadata?.license ? getLicenseLabel(visit.metadata.license) : undefined,
          ])}
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-2">
            ${description}
          </p>
          ${levels.length > 0
            ? html`
                <div class="flex flex-wrap gap-1">
                  ${levels.map(
                    (level) =>
                      html`<ui-badge
                        variant="secondary"
                        size="sm"
                        .label=${getLanguageLevelLabel(level)}
                      ></ui-badge>`,
                  )}
                </div>
              `
            : nothing}
        `}
      ></ui-media-card>
    `;
  }

  render() {
    return html`
      <div class="space-y-5">
        <ui-page-header
          .title=${__('Acquisti')}
          .description=${__('I contenuti acquistati che puoi riutilizzare')}
          .help=${__(
            'Item e visite che hai già comprato dal Marketplace. Restano disponibili qui senza doverli ricomprare, anche per usarli come base di una nuova visita.',
          )}
        ></ui-page-header>

        <ui-filter-tabs
          .tabs=${[
            { value: 'items', label: __('Item acquistati') },
            { value: 'visits', label: __('Visite acquistate') },
          ]}
          .value=${this.tab}
          @filter-change=${(e: CustomEvent) => (this.tab = e.detail.value as PurchaseTab)}
        ></ui-filter-tabs>

        ${renderFeedbackAlerts({ error: this.error })}
        ${this.loading
          ? html`<ui-loading .text=${__('Caricamento acquisti...')}></ui-loading>`
          : this.tab === 'items'
            ? this.purchasedItems.length === 0
              ? html`<ui-empty icon="document" .title=${__('Nessun item acquistato')}></ui-empty>`
              : html`<ui-data-grid
                  .items=${this.purchasedItems}
                  .columns=${3}
                  .renderItem=${(item: Item) => this.renderPurchasedItem(item)}
                ></ui-data-grid>`
            : this.purchasedVisits.length === 0
              ? html`<ui-empty icon="map" .title=${__('Nessuna visita acquistata')}></ui-empty>`
              : html`<ui-data-grid
                  .items=${this.purchasedVisits}
                  .columns=${3}
                  .renderItem=${(visit: Visit) => this.renderPurchasedVisit(visit)}
                ></ui-data-grid>`}
      </div>
    `;
  }
}
