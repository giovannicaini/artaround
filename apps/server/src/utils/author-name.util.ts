/*
 * File: /src/utils/author-name.util.ts                                                  *
 * Project: @artaround/server                                                            *
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

/**
 * Risolve il nome visualizzato dell'autore di un contenuto a partire dal suo authorId.
 */
import { User } from '../models/index.js';

interface HasAuthorId {
  authorId: string;
  authorName?: string;
}

// Item/Visit non salvano un nome autore in cache: risolve `authorName`
// sempre al volo dall'authorId, con una sola query per tutti gli autori
// distinti coinvolti — mai scritto sul documento, solo sulla risposta.
export async function attachAuthorNames<T extends HasAuthorId>(docs: T[]): Promise<T[]> {
  const authorIds = Array.from(new Set(docs.map((d) => d.authorId)));
  if (authorIds.length === 0) return docs;

  const users = await User.find({ _id: { $in: authorIds } })
    .select('username')
    .lean();
  const usernameById = new Map(users.map((u) => [String(u._id), u.username]));

  for (const doc of docs) {
    doc.authorName = usernameById.get(doc.authorId);
  }

  return docs;
}
