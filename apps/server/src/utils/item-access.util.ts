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
import type { GeneratedAudio } from '@artaround/shared';

async function getPurchasedItemIds(userId: string): Promise<Set<string>> {
  const purchases = await ItemPurchase.find({ userId }).select('itemId').lean();
  return new Set(purchases.map((p) => String(p.itemId)));
}

// Filtro Mongo per gli Item che un utente può *usare* (abbinare a una tappa
// di una visita che sta costruendo) — a differenza del catalogo pubblico
// del marketplace (dove chiunque vede tutto, per poterlo valutare/acquistare),
// qui si restringe a: propri contenuti, contenuti gratuiti, contenuti
// acquistati. Usato da ItemController.getUsableItemsForArtwork/
// getUsableItemsByReferenceType (vedi item.routes.ts) — mai dagli endpoint
// pubblici di sfoglio (getAll/getByArtwork/getByReference/search), che
// restano intenzionalmente non filtrati.
export async function buildUsableItemsFilter(userId: string): Promise<Record<string, unknown>> {
  const purchasedItemIds = await getPurchasedItemIds(userId);

  return {
    $or: [{ authorId: userId }, { isFree: true }, { _id: { $in: Array.from(purchasedItemIds) } }],
  };
}

// Forma minima su cui opera redactUnpurchasedItems — funziona sia su
// documenti .lean() sia su oggetti già serializzati per la risposta.
interface RedactableItem {
  _id: unknown;
  authorId: string;
  isFree: boolean;
  text: string;
  translatedTexts?: unknown;
  audio?: Partial<Record<string, GeneratedAudio>>;
  locked?: boolean;
}

// Toglie il contenuto vero e proprio (testo, traduzioni, audio) dagli item a
// pagamento che l'utente (loggato o meno) non può leggere per intero —
// gratuiti, propri, o già acquistati restano intatti. Va applicata da OGNI
// endpoint pubblico di sfoglio (getAll/getByArtwork/getByReference/search/
// getById), altrimenti il filtro "usable" dell'editor visite (sopra) è
// aggirabile chiamando direttamente questi endpoint: prima di questa
// funzione lo facevano, esponendo testo e audio di item mai acquistati a
// chiunque, autenticato o no. Il resto dei campi (titolo, prezzo, durata...)
// resta sempre visibile: serve per la vetrina del marketplace.
export async function redactUnpurchasedItems<T extends RedactableItem>(
  items: T[],
  userId: string | undefined,
): Promise<T[]> {
  const purchasedItemIds = userId ? await getPurchasedItemIds(userId) : new Set<string>();

  return items.map((item) => {
    const canReadFull =
      item.isFree ||
      (!!userId && (item.authorId === userId || purchasedItemIds.has(String(item._id))));
    if (canReadFull) return item;

    return {
      ...item,
      text: '',
      translatedTexts: undefined,
      audio: undefined,
      locked: true,
    };
  });
}
