import { User } from '../models/index.js';

interface HasAuthorId {
  authorId: string;
  authorName?: string;
}

/**
 * Item/Visit non salvano un nome autore in cache: risolve `authorName`
 * sempre al volo dall'authorId, con una sola query per tutti gli autori
 * distinti coinvolti — mai scritto sul documento, solo sulla risposta.
 */
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
