import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type Item, type User, type Visit } from '@artaround/shared';
import { marketplaceService, PurchaseError } from '../../services/marketplace.service';
import { preferencesService } from '../../services/preferences.service';
import { isContentCreator } from '../../services/permissions.service';
import '../ui/ui-page-header';
import '../ui/ui-filter-tabs';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-empty';
import '../ui/ui-data-grid';
import '../ui/ui-media-card';
import '../ui/ui-badge';
import '../ui/ui-button';
import '../ui/ui-icon';
import { __ } from '../../services/i18n.service';

type MarketplaceTab = 'items' | 'visits';

@customElement('marketplace-page')
export class MarketplacePage extends LitElement {
  @property({ type: Object }) user: User | null = null;

  @state() private tab: MarketplaceTab = 'items';
  @state() private loading = true;
  @state() private error = '';
  @state() private items: Item[] = [];
  @state() private visits: Visit[] = [];
  @state() private purchasedItemIds = new Set<string>();
  @state() private purchasedVisitIds = new Set<string>();
  @state() private purchasingId = '';
  @state() private insufficientCredit = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadData();
  }

  private async loadData() {
    this.loading = true;
    this.error = '';

    try {
      const selectedMuseum = preferencesService.getSelectedMuseum();
      const museumId = selectedMuseum?._id;

      const [itemsRes, visitsRes, itemPurchases, visitPurchases] = await Promise.all([
        marketplaceService.getItems({ museumId: museumId || undefined, limit: 60 }),
        marketplaceService.getVisits({ museumId: museumId || undefined, limit: 60 }),
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

  private async handlePurchaseItem(item: Item) {
    this.purchasingId = item._id;
    this.error = '';
    this.insufficientCredit = false;
    try {
      await marketplaceService.purchaseItem(item._id);
      this.purchasedItemIds = new Set([...this.purchasedItemIds, item._id]);
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
    // A differenza degli item (riusati dagli autori per costruire nuove visite), le visite
    // sono il prodotto finito destinato al visitatore finale: per specifica il Navigator
    // fornisce "accesso al marketplace" per scegliere/acquistare la visita da eseguire,
    // quindi qui NON va ristretto agli autori.
    if (visit.authorId === this.user._id) return false;
    return !this.purchasedVisitIds.has(visit._id);
  }

  private renderItemCard(item: Item) {
    const isMine = this.user?._id === item.authorId;
    const isPurchased = this.purchasedItemIds.has(item._id);
    const canBuy = this.canBuyItem(item);

    return html`
      <ui-media-card
        .imageSrc=${item.image || ''}
        .imageAlt=${item.title}
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
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${item.title}
          </h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">
            ${item.text}
          </p>
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

    return html`
      <ui-media-card
        .imageSrc=${visit.coverImage || ''}
        .imageAlt=${visit.title}
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
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${visit.title}
          </h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">
            ${visit.description}
          </p>
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

  render() {
    return html`
      <div class="space-y-5">
        <ui-page-header
          .title=${__('Marketplace')}
          .description=${__('Acquista contenuti creati da altri utenti')}
          .help=${__(
            'Vetrina di item e visite in vendita, creati da altri autori. Acquistandoli il costo viene scalato dal tuo credito e li ritrovi poi in "Acquisti".',
          )}
        ></ui-page-header>

        <ui-filter-tabs
          .tabs=${[
            { value: 'items', label: __('Item') },
            { value: 'visits', label: __('Visite') },
          ]}
          .value=${this.tab}
          @filter-change=${(e: CustomEvent) => (this.tab = e.detail.value as MarketplaceTab)}
        ></ui-filter-tabs>

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
              : html`<ui-data-grid
                  .items=${this.items}
                  .columns=${3}
                  .renderItem=${(item: Item) => this.renderItemCard(item)}
                ></ui-data-grid>`
            : this.visits.length === 0
              ? html`<ui-empty icon="map" .title=${__('Nessuna visita disponibile')}></ui-empty>`
              : html`<ui-data-grid
                  .items=${this.visits}
                  .columns=${3}
                  .renderItem=${(visit: Visit) => this.renderVisitCard(visit)}
                ></ui-data-grid>`}
      </div>
    `;
  }
}
