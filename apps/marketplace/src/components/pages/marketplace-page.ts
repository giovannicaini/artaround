/*
 * File: /src/components/pages/marketplace-page.ts                                       *
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
import {
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  type Item,
  type User,
  type Visit,
} from '@artaround/shared';
import { marketplaceService, PurchaseError } from '../../services/marketplace.service';
import { preferencesService } from '../../services/preferences.service';
import { authService } from '../../services/auth.service';
import { isContentCreator } from '../../services/permissions.service';
import {
  getReferenceTypeLabel,
  getContentDurationLabel,
  getLanguageLevelLabel,
  getLicenseLabel,
  getReferenceTypeOptions,
  getContentDurationOptions,
  getLanguageLevelOptions,
} from '../../utils/enum-labels';
import { getLocalizedText } from '../../utils/localized-text';
import { renderMetaRow } from '../../utils/render-meta-row';
import '../ui/ui-page-header';
import '../ui/ui-filter-tabs';
import '../ui/ui-list-controls';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-checkbox';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-empty';
import '../ui/ui-data-grid';
import '../ui/ui-media-card';
import '../ui/ui-table';
import '../ui/ui-badge';
import '../ui/ui-button';
import '../ui/ui-view-toggle';
import '../ui/ui-icon';
import type { TableColumn } from '../ui/ui-table';
import { __ } from '../../services/i18n.service';

type MarketplaceTab = 'items' | 'visits';
type ListLayout = 'grid' | 'table';
type TriBoolFilter = 'true' | 'false' | '';
type ItemSortBy = 'createdAt' | 'price' | 'usage';
type VisitSortBy = 'createdAt' | 'price' | 'downloads';

/**
 * Marketplace: item e visite acquistabili di altri autori.
 */
@customElement('marketplace-page')
export class MarketplacePage extends LitElement {
  @property({ type: Object }) user: User | null = null;

  // Un visitatore semplice può solo acquistare visite, mai item — si parte sempre
  // da "Visite" per non mostrare un tab che sta per sparire.
  @state() private tab: MarketplaceTab = 'visits';
  @state() private loading = true;
  @state() private error = '';
  @state() private items: Item[] = [];
  @state() private visits: Visit[] = [];
  @state() private purchasedItemIds = new Set<string>();
  @state() private purchasedVisitIds = new Set<string>();
  @state() private purchasingId = '';
  @state() private insufficientCredit = false;

  // ─── Filtri (stesso pattern collassabile di contents-page.ts) ──────
  @state() private controlsCollapsed = true;
  @state() private listLayout: ListLayout = 'grid';
  @state() private searchQuery = '';
  @state() private filterIsFree: TriBoolFilter = '';
  @state() private filterAllMuseums = false;
  @state() private itemSortBy: ItemSortBy = 'createdAt';
  @state() private itemFilterReferenceType: ItemReferenceType | '' = '';
  @state() private itemFilterDuration: ContentDuration | '' = '';
  @state() private itemFilterLanguageLevel: LanguageLevel | '' = '';
  @state() private visitSortBy: VisitSortBy = 'createdAt';
  @state() private visitFilterLanguageLevel: LanguageLevel | '' = '';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.tab === 'items' && !isContentCreator(this.user)) {
      this.tab = 'visits';
    }
    void this.loadData();
  }

  private get isCreator(): boolean {
    return isContentCreator(this.user);
  }

  private get activeFilterCount(): number {
    const shared = [this.searchQuery, this.filterIsFree, this.filterAllMuseums ? '1' : ''].filter(
      Boolean,
    ).length;
    if (this.tab === 'items') {
      return (
        shared +
        [
          this.itemFilterReferenceType,
          this.itemFilterDuration,
          this.itemFilterLanguageLevel,
        ].filter(Boolean).length
      );
    }
    return shared + (this.visitFilterLanguageLevel ? 1 : 0);
  }

  private get referenceTypeFilterOptions() {
    return getReferenceTypeOptions();
  }

  private get durationFilterOptions() {
    return getContentDurationOptions();
  }

  private get languageLevelFilterOptions() {
    return getLanguageLevelOptions();
  }

  private async loadData() {
    this.loading = true;
    this.error = '';

    try {
      const selectedMuseum = preferencesService.getSelectedMuseum();
      const museumId = this.filterAllMuseums ? undefined : selectedMuseum?._id || undefined;
      const search = this.searchQuery.trim() || undefined;
      const isFree = this.filterIsFree ? this.filterIsFree === 'true' : undefined;

      const [itemsRes, visitsRes, itemPurchases, visitPurchases] = await Promise.all([
        this.isCreator
          ? marketplaceService.getItems({
              museumId,
              limit: 60,
              search,
              isFree,
              sortBy: this.itemSortBy,
              referenceType: this.itemFilterReferenceType || undefined,
              duration: this.itemFilterDuration || undefined,
              languageLevel: this.itemFilterLanguageLevel || undefined,
            })
          : Promise.resolve({ items: [] as Item[], total: 0 }),
        marketplaceService.getVisits({
          museumId,
          limit: 60,
          search,
          isFree,
          sortBy: this.visitSortBy,
          languageLevel: this.visitFilterLanguageLevel || undefined,
        }),
        marketplaceService.getMyItemPurchases().catch(() => []),
        marketplaceService.getMyVisitPurchases().catch(() => []),
      ]);

      this.items = itemsRes.items;
      this.visits = visitsRes.visits;
      this.purchasedItemIds = new Set(itemPurchases.map((purchase) => purchase.item._id));
      this.purchasedVisitIds = new Set(visitPurchases.map((purchase) => purchase.visit._id));
    } catch (e) {
      console.error('Error loading marketplace:', e);
      this.error = __('Impossibile caricare il marketplace');
    } finally {
      this.loading = false;
    }
  }

  private applyFilters() {
    void this.loadData();
  }

  private handleResetFilters() {
    this.searchQuery = '';
    this.filterIsFree = '';
    this.filterAllMuseums = false;
    this.itemFilterReferenceType = '';
    this.itemFilterDuration = '';
    this.itemFilterLanguageLevel = '';
    this.visitFilterLanguageLevel = '';
    void this.loadData();
  }

  // Il saldo in topbar viene da app-root's currentUser: senza "user-updated"
  // resterebbe quello di prima dell'acquisto finché non si ricarica la pagina.
  private async refreshCurrentUserCredit() {
    try {
      const freshUser = await authService.getCurrentUser();
      if (freshUser) {
        this.dispatchEvent(
          new CustomEvent('user-updated', { detail: freshUser, bubbles: true, composed: true }),
        );
      }
    } catch (e) {
      console.error('Error refreshing user credit:', e);
    }
  }

  private async handlePurchaseItem(item: Item) {
    this.purchasingId = item._id;
    this.error = '';
    this.insufficientCredit = false;
    try {
      await marketplaceService.purchaseItem(item._id);
      this.purchasedItemIds = new Set([...this.purchasedItemIds, item._id]);
      void this.refreshCurrentUserCredit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : __('Acquisto item non riuscito');
      this.insufficientCredit = e instanceof PurchaseError && e.code === 'INSUFFICIENT_CREDIT';
    } finally {
      this.purchasingId = '';
    }
  }

  private async handlePurchaseVisit(visit: Visit) {
    this.purchasingId = visit._id;
    this.error = '';
    this.insufficientCredit = false;
    try {
      await marketplaceService.purchaseVisit(visit._id);
      this.purchasedVisitIds = new Set([...this.purchasedVisitIds, visit._id]);
      void this.refreshCurrentUserCredit();
    } catch (e) {
      this.error = e instanceof Error ? e.message : __('Acquisto visita non riuscito');
      this.insufficientCredit = e instanceof PurchaseError && e.code === 'INSUFFICIENT_CREDIT';
    } finally {
      this.purchasingId = '';
    }
  }

  private goToAccount() {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: 'settings' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private canBuyItem(item: Item): boolean {
    if (!this.user) return false;
    // Rispecchia authorizeContentCreator() lato server (marketplace.routes.ts):
    // serve essere curatore/autore di almeno un museo, non un ruolo globale.
    if (!isContentCreator(this.user)) return false;
    if (item.authorId === this.user._id) return false;
    return !this.purchasedItemIds.has(item._id);
  }

  private canBuyVisit(visit: Visit): boolean {
    if (!this.user) return false;
    // Le visite sono il prodotto finito per il visitatore finale: qui NON va ristretto agli autori.
    if (visit.authorId === this.user._id) return false;
    return !this.purchasedVisitIds.has(visit._id);
  }

  private renderItemCard(item: Item) {
    const isMine = this.user?._id === item.authorId;
    const isPurchased = this.purchasedItemIds.has(item._id);
    const canBuy = this.canBuyItem(item);
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
          isMine
            ? html`<ui-badge variant="success" size="sm" .label=${__('Mio')}></ui-badge>`
            : isPurchased
              ? html`<ui-badge variant="primary" size="sm" .label=${__('Acquistato')}></ui-badge>`
              : item.isFree
                ? html`<ui-badge variant="success" size="sm" .label=${__('Gratuito')}></ui-badge>`
                : html`<ui-badge
                    variant="warning"
                    size="sm"
                    .label=${`€${item.price || 0}`}
                  ></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">${title}</h3>
          ${renderMetaRow([
            item.authorName ? `${__('di')} ${item.authorName}` : undefined,
            getReferenceTypeLabel(item.referenceType),
            getContentDurationLabel(item.duration),
            getLanguageLevelLabel(item.languageLevel),
            item.license ? getLicenseLabel(item.license) : undefined,
          ])}
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">${text}</p>
          <div class="flex items-center justify-end">
            ${canBuy
              ? html`<ui-button
                  size="sm"
                  variant="primary"
                  ?loading=${this.purchasingId === item._id}
                  .label=${__('Acquista')}
                  @click=${() => this.handlePurchaseItem(item)}
                ></ui-button>`
              : html`
                  <span class="text-xs text-surface-500 dark:text-surface-400">
                    ${isMine
                      ? __('Creato da te')
                      : isPurchased
                        ? __('Già acquistato')
                        : !isContentCreator(this.user)
                          ? __('Acquistabile solo da curatori/autori')
                          : __('Non acquistabile')}
                  </span>
                `}
          </div>
        `}
      ></ui-media-card>
    `;
  }

  private renderVisitCard(visit: Visit) {
    const isMine = this.user?._id === visit.authorId;
    const isPurchased = this.purchasedVisitIds.has(visit._id);
    const canBuy = this.canBuyVisit(visit);
    const levels = visit.targetAudience?.languageLevels || [];
    const title = getLocalizedText(visit.title, visit.titleTranslations);
    const description = getLocalizedText(visit.description, visit.descriptionTranslations);

    return html`
      <ui-media-card
        .imageSrc=${visit.coverImage || ''}
        .imageAlt=${title}
        placeholderType="museum"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          isMine
            ? html`<ui-badge variant="success" size="sm" .label=${__('Mia')}></ui-badge>`
            : isPurchased
              ? html`<ui-badge variant="primary" size="sm" .label=${__('Acquistata')}></ui-badge>`
              : visit.metadata?.isFree
                ? html`<ui-badge variant="success" size="sm" .label=${__('Gratuita')}></ui-badge>`
                : html`<ui-badge
                    variant="warning"
                    size="sm"
                    .label=${`€${visit.metadata?.price || 0}`}
                  ></ui-badge>`}
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
                <div class="flex flex-wrap gap-1 mb-3">
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
          <div class="flex items-center justify-end">
            ${canBuy
              ? html`<ui-button
                  size="sm"
                  variant="primary"
                  ?loading=${this.purchasingId === visit._id}
                  .label=${__('Acquista')}
                  @click=${() => this.handlePurchaseVisit(visit)}
                ></ui-button>`
              : html`
                  <span class="text-xs text-surface-500 dark:text-surface-400">
                    ${isMine
                      ? __('Creata da te')
                      : isPurchased
                        ? __('Già acquistata')
                        : __('Non acquistabile')}
                  </span>
                `}
          </div>
        `}
      ></ui-media-card>
    `;
  }

  private renderControlsSummary() {
    return html`
      <ui-badge
        variant=${this.activeFilterCount > 0 ? 'primary' : 'secondary'}
        .label=${`${this.activeFilterCount} ${__('filtri')}`}
      ></ui-badge>
    `;
  }

  private renderSharedControls() {
    const selectedMuseum = preferencesService.getSelectedMuseum();

    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ui-input
          .label=${__('Ricerca')}
          .placeholder=${this.tab === 'items' ? __('Cerca item...') : __('Cerca visite...')}
          .value=${this.searchQuery}
          @input-change=${(e: CustomEvent<{ value: string }>) => {
            this.searchQuery = e.detail.value;
          }}
        ></ui-input>

        <ui-select
          .label=${__('Prezzo')}
          .placeholder=${__('Gratuiti e a pagamento')}
          clearable
          .value=${this.filterIsFree}
          .options=${[
            { value: 'true', label: __('Solo gratuiti') },
            { value: 'false', label: __('Solo a pagamento') },
          ]}
          @select-change=${(e: CustomEvent<{ value: TriBoolFilter }>) => {
            this.filterIsFree = e.detail.value;
          }}
        ></ui-select>

        ${this.tab === 'items'
          ? html`
              <ui-select
                .label=${__('Ordina per')}
                .value=${this.itemSortBy}
                .options=${[
                  { value: 'createdAt', label: __('Più recenti') },
                  { value: 'price', label: __('Prezzo crescente') },
                  { value: 'usage', label: __('Più usati') },
                ]}
                @select-change=${(e: CustomEvent<{ value: ItemSortBy }>) => {
                  this.itemSortBy = e.detail.value;
                }}
              ></ui-select>
            `
          : html`
              <ui-select
                .label=${__('Ordina per')}
                .value=${this.visitSortBy}
                .options=${[
                  { value: 'createdAt', label: __('Più recenti') },
                  { value: 'price', label: __('Prezzo crescente') },
                  { value: 'downloads', label: __('Più scaricate') },
                ]}
                @select-change=${(e: CustomEvent<{ value: VisitSortBy }>) => {
                  this.visitSortBy = e.detail.value;
                }}
              ></ui-select>
            `}

        <ui-view-toggle
          .value=${this.listLayout}
          @layout-change=${(e: CustomEvent<{ value: ListLayout }>) => {
            this.listLayout = e.detail.value;
          }}
        ></ui-view-toggle>
      </div>

      <div>
        <label class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
          <ui-checkbox
            .checked=${this.filterAllMuseums}
            @checkbox-change=${(e: CustomEvent<{ checked: boolean }>) => {
              this.filterAllMuseums = e.detail.checked;
            }}
          ></ui-checkbox>
          ${selectedMuseum
            ? __('Cerca in tutti i musei, non solo') + ` "${selectedMuseum.name}"`
            : __('Cerca in tutti i musei')}
        </label>
      </div>

      ${this.tab === 'items'
        ? html`
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ui-select
                .label=${__('Tipo di riferimento')}
                .placeholder=${__('Tutti i tipi')}
                clearable
                .value=${this.itemFilterReferenceType}
                .options=${this.referenceTypeFilterOptions}
                @select-change=${(e: CustomEvent<{ value: ItemReferenceType | '' }>) => {
                  this.itemFilterReferenceType = e.detail.value;
                }}
              ></ui-select>

              <ui-select
                .label=${__('Durata')}
                .placeholder=${__('Tutte le durate')}
                clearable
                .value=${this.itemFilterDuration}
                .options=${this.durationFilterOptions}
                @select-change=${(e: CustomEvent<{ value: ContentDuration | '' }>) => {
                  this.itemFilterDuration = e.detail.value;
                }}
              ></ui-select>

              <ui-select
                .label=${__('Livello linguistico')}
                .placeholder=${__('Tutti i livelli')}
                clearable
                .value=${this.itemFilterLanguageLevel}
                .options=${this.languageLevelFilterOptions}
                @select-change=${(e: CustomEvent<{ value: LanguageLevel | '' }>) => {
                  this.itemFilterLanguageLevel = e.detail.value;
                }}
              ></ui-select>
            </div>
          `
        : html`
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ui-select
                .label=${__('Livello linguistico')}
                .placeholder=${__('Tutti i livelli')}
                clearable
                .value=${this.visitFilterLanguageLevel}
                .options=${this.languageLevelFilterOptions}
                @select-change=${(e: CustomEvent<{ value: LanguageLevel | '' }>) => {
                  this.visitFilterLanguageLevel = e.detail.value;
                }}
              ></ui-select>
            </div>
          `}

      <div class="flex items-center gap-2">
        <ui-button
          variant="primary"
          size="sm"
          icon="search"
          .label=${__('Applica filtri')}
          @click=${() => this.applyFilters()}
        ></ui-button>
        <ui-button
          variant="secondary"
          size="sm"
          .label=${__('Reset')}
          @click=${() => this.handleResetFilters()}
        ></ui-button>
      </div>
    `;
  }

  // ─── Vista tabella (alternativa alla griglia di card) ──────
  private renderStatusCell(
    isMine: boolean,
    isPurchased: boolean,
    isFree: boolean | undefined,
    price: number | undefined,
    mineLabel: string,
    purchasedLabel: string,
  ): unknown {
    if (isMine) return html`<ui-badge variant="success" size="sm" .label=${mineLabel}></ui-badge>`;
    if (isPurchased)
      return html`<ui-badge variant="primary" size="sm" .label=${purchasedLabel}></ui-badge>`;
    if (isFree)
      return html`<ui-badge variant="success" size="sm" .label=${__('Gratuito')}></ui-badge>`;
    return html`<ui-badge variant="warning" size="sm" .label=${`€${price || 0}`}></ui-badge>`;
  }

  private buildItemTableColumns(): TableColumn[] {
    return [
      { key: 'title', label: __('Titolo') },
      { key: 'author', label: __('Autore') },
      { key: 'referenceType', label: __('Tipo') },
      { key: 'duration', label: __('Durata') },
      { key: 'languageLevel', label: __('Livello') },
      { key: 'license', label: __('Licenza') },
      {
        key: 'status',
        label: __('Stato'),
        align: 'right',
        render: (_value, row) => {
          const item = row.__item as Item;
          return this.renderStatusCell(
            this.user?._id === item.authorId,
            this.purchasedItemIds.has(item._id),
            item.isFree,
            item.price,
            __('Mio'),
            __('Acquistato'),
          );
        },
      },
      {
        key: 'action',
        label: '',
        align: 'right',
        render: (_value, row) => {
          const item = row.__item as Item;
          return this.canBuyItem(item)
            ? html`<ui-button
                size="xs"
                variant="primary"
                ?loading=${this.purchasingId === item._id}
                .label=${__('Acquista')}
                @click=${() => this.handlePurchaseItem(item)}
              ></ui-button>`
            : nothing;
        },
      },
    ];
  }

  private buildItemTableRows(items: Item[]): Record<string, unknown>[] {
    return items.map((item) => ({
      title: getLocalizedText(item.title, item.translatedTitles),
      author: item.authorName || '—',
      referenceType: getReferenceTypeLabel(item.referenceType),
      duration: getContentDurationLabel(item.duration),
      languageLevel: getLanguageLevelLabel(item.languageLevel),
      license: item.license ? getLicenseLabel(item.license) : '—',
      __item: item,
    }));
  }

  private buildVisitTableColumns(): TableColumn[] {
    return [
      { key: 'title', label: __('Titolo') },
      { key: 'author', label: __('Autore') },
      { key: 'duration', label: __('Durata') },
      { key: 'license', label: __('Licenza') },
      {
        key: 'status',
        label: __('Stato'),
        align: 'right',
        render: (_value, row) => {
          const visit = row.__visit as Visit;
          return this.renderStatusCell(
            this.user?._id === visit.authorId,
            this.purchasedVisitIds.has(visit._id),
            visit.metadata?.isFree,
            visit.metadata?.price,
            __('Mia'),
            __('Acquistata'),
          );
        },
      },
      {
        key: 'action',
        label: '',
        align: 'right',
        render: (_value, row) => {
          const visit = row.__visit as Visit;
          return this.canBuyVisit(visit)
            ? html`<ui-button
                size="xs"
                variant="primary"
                ?loading=${this.purchasingId === visit._id}
                .label=${__('Acquista')}
                @click=${() => this.handlePurchaseVisit(visit)}
              ></ui-button>`
            : nothing;
        },
      },
    ];
  }

  private buildVisitTableRows(visits: Visit[]): Record<string, unknown>[] {
    return visits.map((visit) => ({
      title: getLocalizedText(visit.title, visit.titleTranslations),
      author: visit.authorName || '—',
      duration: visit.targetAudience?.estimatedDuration
        ? `${visit.targetAudience.estimatedDuration} ${__('min')}`
        : '—',
      license: visit.metadata?.license ? getLicenseLabel(visit.metadata.license) : '—',
      __visit: visit,
    }));
  }

  render() {
    const tabs = this.isCreator
      ? [
          { value: 'items', label: __('Item') },
          { value: 'visits', label: __('Visite') },
        ]
      : [{ value: 'visits', label: __('Visite') }];

    return html`
      <div class="space-y-5">
        <ui-page-header
          .title=${__('Marketplace')}
          .description=${__('Acquista contenuti creati da altri utenti')}
          .help=${__(
            'Vetrina di item e visite in vendita, creati da altri autori. Acquistandoli il costo viene scalato dal tuo credito e li ritrovi poi in "Acquisti".',
          )}
        ></ui-page-header>

        <div class="mb-3">
          ${tabs.length > 1
            ? html`
                <ui-filter-tabs
                  .tabs=${tabs}
                  .value=${this.tab}
                  @filter-change=${(e: CustomEvent) => {
                    this.tab = e.detail.value as MarketplaceTab;
                    void this.loadData();
                  }}
                ></ui-filter-tabs>
              `
            : html`
                <h2 class="text-base font-semibold text-surface-900 dark:text-white">
                  ${__('Visite in vendita')}
                </h2>
              `}
        </div>

        <ui-list-controls
          .title=${__('Filtri e visualizzazione')}
          .description=${__(
            'Espandi per filtrare per prezzo, livello, durata e museo, cercare per testo e cambiare vista',
          )}
          .collapsed=${this.controlsCollapsed}
          .renderSummary=${() => this.renderControlsSummary()}
          .renderContent=${() => this.renderSharedControls()}
          @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
            (this.controlsCollapsed = e.detail.collapsed)}
        ></ui-list-controls>

        ${this.error
          ? html`
              <div class="space-y-2">
                <ui-alert variant="danger" .message=${this.error}></ui-alert>
                ${this.insufficientCredit
                  ? html`
                      <ui-button
                        variant="secondary"
                        size="sm"
                        icon="euro"
                        .label=${__('Ricarica credito')}
                        @click=${() => this.goToAccount()}
                      ></ui-button>
                    `
                  : nothing}
              </div>
            `
          : nothing}
        ${this.loading
          ? html`<ui-loading .text=${__('Caricamento marketplace...')}></ui-loading>`
          : this.tab === 'items'
            ? this.items.length === 0
              ? html`<ui-empty icon="document" .title=${__('Nessun item disponibile')}></ui-empty>`
              : this.listLayout === 'grid'
                ? html`<ui-data-grid
                    .items=${this.items}
                    .columns=${3}
                    .renderItem=${(item: Item) => this.renderItemCard(item)}
                  ></ui-data-grid>`
                : html`<ui-table
                    .columns=${this.buildItemTableColumns()}
                    .data=${this.buildItemTableRows(this.items)}
                    compact
                    striped
                  ></ui-table>`
            : this.visits.length === 0
              ? html`<ui-empty icon="map" .title=${__('Nessuna visita disponibile')}></ui-empty>`
              : this.listLayout === 'grid'
                ? html`<ui-data-grid
                    .items=${this.visits}
                    .columns=${3}
                    .renderItem=${(visit: Visit) => this.renderVisitCard(visit)}
                  ></ui-data-grid>`
                : html`<ui-table
                    .columns=${this.buildVisitTableColumns()}
                    .data=${this.buildVisitTableRows(this.visits)}
                    compact
                    striped
                  ></ui-table>`}
      </div>
    `;
  }
}
