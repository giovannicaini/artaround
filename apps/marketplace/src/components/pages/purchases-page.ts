import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Item, User, Visit } from '@artaround/shared';
import { marketplaceService } from '../../services/marketplace.service';
import '../ui/ui-page-header';
import '../ui/ui-filter-tabs';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-empty';
import '../ui/ui-data-grid';
import '../ui/ui-media-card';
import '../ui/ui-badge';
import { __ } from '../../services/i18n.service';

type PurchaseTab = 'items' | 'visits';

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
    return html`
      <ui-media-card
        .imageSrc=${item.image || ''}
        .imageAlt=${item.title}
        placeholderType="content"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          html`<ui-badge variant="primary" size="sm" .label=${__('Acquistato')}></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${item.title}
          </h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">${item.text}</p>
        `}
      ></ui-media-card>
    `;
  }

  private renderPurchasedVisit(visit: Visit) {
    return html`
      <ui-media-card
        .imageSrc=${visit.coverImage || ''}
        .imageAlt=${visit.title}
        placeholderType="museum"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          html`<ui-badge variant="primary" size="sm" .label=${__('Acquistata')}></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${visit.title}
          </h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">
            ${visit.description}
          </p>
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

        ${this.error ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>` : ''}
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
