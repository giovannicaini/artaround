/*
 * File: /src/utils/policy.util.ts                                                       *
 * Project: @artaround/server                                                            *
 * Last Modified: 07/09/2026                                                             *
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
 * Regole di autorizzazione su risorse legate a un museo (chi può gestire/creare cosa in base al proprio ruolo).
 */
import { Response, NextFunction } from 'express';
import { MuseumRole, MuseumRoleAssignment } from '@artaround/shared';
import { User } from '../models/index.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { resolveMuseumIdCandidates } from './museum-id.util.js';

// Sistema centralizzato di autorizzazione.
//
// Ruoli: l'unico ruolo globale è User.isAdmin. Non esiste un CURATOR o un
// AUTHOR generico: un utente è curatore o autore SOLO di uno o più musei
// specifici, tramite User.museumRoles. Chi li assegna:
// - CURATOR su un museo: solo un ADMIN (vedi MuseumController.addCurator).
// - AUTHOR su un museo: un ADMIN, oppure il CURATOR di quello stesso museo,
//   per promuovere un utente già a sistema (vedi MuseumController.addAuthor).
//
// Regole di contenuto:
// - ADMIN: può sempre tutto.
// - CURATOR di un museo: può gestire quel museo e tutto il suo contenuto
//   (opere, item, visite), non quello di altri musei.
// - AUTHOR di un museo: può creare item per qualunque museo (un item non
//   "appartiene" a un museo nello stesso senso di un'opera — è contenuto
//   riusabile), ma può creare una visita solo per un museo di cui è
//   curatore o autore. Su un item o una visita che ha creato lui stesso può
//   sempre agire, ovunque.
//
// can() è la fonte di verità unica: sia il middleware da route (authorizeResource/
// authorizeCreate, per i casi in cui il museo è già noto da :params o dal
// body) sia i controller (per i casi in cui il museo si scopre solo dopo aver
// caricato la risorsa, es. update/delete di un item) chiamano questa stessa
// funzione.

type PolicyAction = 'create' | 'manage'; // manage = update/delete/publish/... su una risorsa esistente
type PolicySubject = 'museum' | 'artwork' | 'item' | 'visit' | 'navigatorConfig';

interface PolicyContext {
  // /** Museo di appartenenza della risorsa (artwork/item/visit) o il museo stesso (subject 'museum').
  museumId?: string;
  // /** authorId della risorsa (item/visit), per il fallback "è sempre roba tua".
  authorId?: string;
}

type AuthUser = NonNullable<AuthRequest['user']>;

async function getMuseumRoles(userId: string): Promise<MuseumRoleAssignment[]> {
  const user = await User.findById(userId).select('museumRoles').lean();
  return user?.museumRoles ?? [];
}

// Ruolo (se esiste) dell'utente su questo specifico museo.
//
// Musei, opere, item e visite salvano `museumId` come QID Wikidata, ma chi
// assegna curatori/autori (MuseumController.addCurator/addAuthor) passa
// quasi sempre l'_id Mongo del museo (vedi museum-id.util.ts) — i due lati
// del confronto possono quindi arrivare in formati diversi. Si risolve
// l'museumId in ingresso in tutti i suoi id equivalenti prima di confrontare,
// altrimenti un curatore/autore vero risulterebbe sempre "non assegnato".
async function getMuseumRole(userId: string, museumId: string): Promise<MuseumRole | undefined> {
  const [assignments, candidates] = await Promise.all([
    getMuseumRoles(userId),
    resolveMuseumIdCandidates(museumId),
  ]);
  const candidateSet = new Set(candidates.length > 0 ? candidates : [museumId]);
  const onThisMuseum = assignments.filter((ra) => candidateSet.has(ra.museumId));
  if (onThisMuseum.some((ra) => ra.role === MuseumRole.CURATOR)) return MuseumRole.CURATOR;
  if (onThisMuseum.some((ra) => ra.role === MuseumRole.AUTHOR)) return MuseumRole.AUTHOR;
  return undefined;
}

// L'utente è curatore di questo specifico museo.
async function isCuratorOf(userId: string, museumId: string): Promise<boolean> {
  return (await getMuseumRole(userId, museumId)) === MuseumRole.CURATOR;
}

// L'utente "fa parte" di questo museo: curatore o autore, indifferentemente.
async function isMemberOf(userId: string, museumId: string): Promise<boolean> {
  return (await getMuseumRole(userId, museumId)) !== undefined;
}

// L'utente è curatore o autore di almeno un museo, non importa quale.
async function isAuthorAnywhere(userId: string): Promise<boolean> {
  return (await getMuseumRoles(userId)).length > 0;
}

// Gli _id Mongo dei musei di cui l'utente è curatore (non autore) — usato
// da NavigatorConfigController.list per filtrare a un curatore solo le
// config dei propri musei.
export async function getCuratedMuseumIds(userId: string): Promise<string[]> {
  const roles = await getMuseumRoles(userId);
  return roles.filter((ra) => ra.role === MuseumRole.CURATOR).map((ra) => ra.museumId);
}

async function can(
  user: AuthUser | undefined,
  action: PolicyAction,
  subject: PolicySubject,
  ctx: PolicyContext = {},
): Promise<boolean> {
  if (!user) return false;
  if (user.isAdmin) return true;

  switch (subject) {
    case 'museum':
      // Creare/eliminare un museo resta un'operazione da admin (già gestita sopra).
      // Modificarlo (nome, piani, sale, marker, lingue, autori...) è concesso
      // al curatore di QUEL museo.
      return action === 'manage' && !!ctx.museumId && (await isCuratorOf(user.id, ctx.museumId));

    case 'artwork':
      // Le opere non hanno un "autore" applicativo: gestibili solo da admin o
      // dal curatore del museo a cui appartengono.
      return !!ctx.museumId && (await isCuratorOf(user.id, ctx.museumId));

    case 'item':
      if (action === 'create') {
        // Basta essere curatore/autore di un museo qualsiasi: un item non
        // dipende da un museo specifico per poter essere creato.
        return isAuthorAnywhere(user.id);
      }
      // manage (update/delete): il proprietario può sempre, ovunque; altrimenti
      // solo il curatore del museo a cui appartiene l'item.
      if (ctx.authorId && ctx.authorId === user.id) return true;
      return !!ctx.museumId && (await isCuratorOf(user.id, ctx.museumId));

    case 'visit':
      if (action === 'create') {
        // A differenza degli item, una visita è legata a un museo preciso:
        // serve essere curatore o autore di QUEL museo.
        return !!ctx.museumId && (await isMemberOf(user.id, ctx.museumId));
      }
      // manage (update/delete/publish/steps/...): proprietario sempre, o
      // curatore del museo della visita.
      if (ctx.authorId && ctx.authorId === user.id) return true;
      return !!ctx.museumId && (await isCuratorOf(user.id, ctx.museumId));

    case 'navigatorConfig':
      // Una config 'global' non ha museumId: qui sotto ctx.museumId è
      // sempre assente per quelle, quindi un non-admin le vede negate
      // automaticamente — solo un curatore del museo può gestire le
      // proprie config Navigator (NavigatorConfigController).
      return !!ctx.museumId && (await isCuratorOf(user.id, ctx.museumId));

    default:
      return false;
  }
}

// Lancia 403 se `can()` nega — da usare nei controller dopo aver caricato la risorsa.
export async function assertCan(
  user: AuthUser | undefined,
  action: PolicyAction,
  subject: PolicySubject,
  ctx: PolicyContext,
  message: string,
): Promise<void> {
  if (!(await can(user, action, subject, ctx))) {
    throw new AppError(403, 'FORBIDDEN', message);
  }
}

// Chi può confermare una richiesta di un utente di diventare curatore o
// autore di un museo: stessa regola di chi può assegnare quel ruolo
// direttamente (MuseumController.addCurator/addAuthor) — CURATOR solo admin,
// AUTHOR anche il curatore di quel museo.
export async function assertCanApproveRoleRequest(
  user: AuthUser | undefined,
  requestedRole: MuseumRole,
  museumId: string,
  message: string,
): Promise<void> {
  const allowed =
    !!user?.isAdmin ||
    (requestedRole === MuseumRole.AUTHOR && !!user && (await isCuratorOf(user.id, museumId)));

  if (!allowed) {
    throw new AppError(403, 'FORBIDDEN', message);
  }
}

// Middleware per le route sotto /museums/:id/... (piani, sale, marker,
// curatori, autori...), dove l'id del museo è sempre req.params.id.
export const authorizeResource = (subject: PolicySubject, action: PolicyAction) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const rawMuseumId = req.params.id;
    const museumId = Array.isArray(rawMuseumId) ? rawMuseumId[0] : rawMuseumId;
    can(req.user, action, subject, { museumId })
      .then((allowed) => {
        if (!allowed) {
          throw new AppError(403, 'FORBIDDEN', 'Non hai i permessi per gestire questo museo');
        }
        next();
      })
      .catch(next);
  };
};

// Middleware per le route di creazione, dove il museo di destinazione è nel
// body (artwork/item/visit non vivono sotto /museums/:id).
export const authorizeCreate = (subject: PolicySubject) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const museumId = typeof req.body?.museumId === 'string' ? req.body.museumId : undefined;
    can(req.user, 'create', subject, { museumId })
      .then((allowed) => {
        if (!allowed) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Non hai i permessi per creare questa risorsa per questo museo',
          );
        }
        next();
      })
      .catch(next);
  };
};

// Middleware per le route che non riguardano un museo preciso, ma vanno
// comunque riservate a "chi crea contenuti": admin, o curatore/autore di
// almeno un museo (es. upload immagini, acquisto item nel marketplace). Un
// semplice VISITOR senza alcun museumRole viene bloccato.
export const authorizeContentCreator = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  can(req.user, 'create', 'item') // isAuthorAnywhere sotto il cofano, nessun museo coinvolto
    .then((allowed) => {
      if (!allowed) {
        throw new AppError(
          403,
          'FORBIDDEN',
          'Devi essere curatore o autore di almeno un museo per eseguire questa operazione',
        );
      }
      next();
    })
    .catch(next);
};
