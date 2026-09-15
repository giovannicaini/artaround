/*
 * File: /src/utils/item-access.util.ts                                                  *
 * Project: @artaround/server                                                            *
 * Last Modified: 08/09/2026                                                             *
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

/**
 * Verifica se un utente può leggere il contenuto completo di un item (proprietario, acquistato, o gratuito).
 */
import { ItemPurchase } from '../models/index.js';

// Filtro Mongo per gli Item che un utente può *usare* (abbinare a una tappa
// di una visita che sta costruendo) — a differenza del catalogo pubblico
// del marketplace (dove chiunque vede tutto, per poterlo valutare/acquistare),
// qui si restringe a: propri contenuti, contenuti gratuiti, contenuti
// acquistati. Usato da ItemController.getUsableItemsForArtwork/
// getUsableItemsByReferenceType (vedi item.routes.ts) — mai dagli endpoint
// pubblici di sfoglio (getAll/getByArtwork/getByReference/search), che
// restano intenzionalmente non filtrati.
export async function buildUsableItemsFilter(userId: string): Promise<Record<string, unknown>> {
  const purchases = await ItemPurchase.find({ userId }).select('itemId').lean();
  const purchasedItemIds = purchases.map((p) => p.itemId);

  return {
    $or: [{ authorId: userId }, { isFree: true }, { _id: { $in: purchasedItemIds } }],
  };
}
