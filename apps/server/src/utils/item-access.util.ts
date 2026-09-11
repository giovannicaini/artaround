import { ItemPurchase } from '../models/index.js';

/**
 * Filtro Mongo per gli Item che un utente può *usare* (abbinare a una tappa
 * di una visita che sta costruendo) — a differenza del catalogo pubblico
 * del marketplace (dove chiunque vede tutto, per poterlo valutare/acquistare),
 * qui si restringe a: propri contenuti, contenuti gratuiti, contenuti
 * acquistati. Usato da ItemController.getUsableItemsForArtwork/
 * getUsableItemsByReferenceType (vedi item.routes.ts) — mai dagli endpoint
 * pubblici di sfoglio (getAll/getByArtwork/getByReference/search), che
 * restano intenzionalmente non filtrati.
 */
export async function buildUsableItemsFilter(userId: string): Promise<Record<string, unknown>> {
  const purchases = await ItemPurchase.find({ userId }).select('itemId').lean();
  const purchasedItemIds = purchases.map((p) => p.itemId);

  return {
    $or: [{ authorId: userId }, { isFree: true }, { _id: { $in: purchasedItemIds } }],
  };
}
