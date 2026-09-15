/*
 * File: /src/services/permissions.service.ts                                            *
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

import { MuseumRole, type User } from '@artaround/shared';

/**
 * Calcola i permessi dell'utente corrente (globali e sul museo attivo).
 */
export interface PermissionSet {
  // Opere
  canCreateArtwork: boolean;
  canEditArtwork: boolean;
  canDeleteArtwork: boolean;

  // Item (contenuti)
  canCreateItem: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;

  // Musei
  canCreateMuseum: boolean;
  canEditMuseum: boolean;
  canDeleteMuseum: boolean;

  // Visite
  canCreateVisit: boolean;
  canEditVisit: boolean;
  canDeleteVisit: boolean;

  // Solo admin
  canManageUsers: boolean;
  canViewAnalytics: boolean;
}

const EMPTY_PERMISSIONS: PermissionSet = {
  canCreateArtwork: false,
  canEditArtwork: false,
  canDeleteArtwork: false,
  canCreateItem: false,
  canEditItem: false,
  canDeleteItem: false,
  canCreateMuseum: false,
  canEditMuseum: false,
  canDeleteMuseum: false,
  canCreateVisit: false,
  canEditVisit: false,
  canDeleteVisit: false,
  canManageUsers: false,
  canViewAnalytics: false,
};

// L'utente è curatore di QUESTO museo specifico (o admin, che può sempre tutto).
export function isMuseumCurator(user: User | null, museumId?: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!museumId) return false;
  return !!user.museumRoles?.some(
    (mr) => mr.museumId === museumId && mr.role === MuseumRole.CURATOR,
  );
}

// L'utente è curatore O autore di QUESTO museo specifico (o admin).
export function isMuseumMember(user: User | null, museumId?: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!museumId) return false;
  return !!user.museumRoles?.some((mr) => mr.museumId === museumId);
}

// L'utente è curatore o autore di ALMENO un museo, non importa quale (o admin).
export function isContentCreator(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!user.museumRoles && user.museumRoles.length > 0;
}

// Ottieni i permessi per un utente, nel contesto di un museo specifico (tipicamente quello selezionato in UI).
export function getPermissions(user: User | null, museumId?: string): PermissionSet {
  if (!user) return { ...EMPTY_PERMISSIONS };

  const curatorOfMuseum = isMuseumCurator(user, museumId);
  const memberOfMuseum = isMuseumMember(user, museumId);
  const contentCreator = isContentCreator(user);
  const isAdmin = user.isAdmin;

  return {
    // Opere: solo il curatore DI QUESTO museo (le opere non hanno un autore applicativo)
    canCreateArtwork: curatorOfMuseum,
    canEditArtwork: curatorOfMuseum,
    canDeleteArtwork: curatorOfMuseum,

    // Item creabili da chiunque sia curatore/autore di un museo qualsiasi; modifica/eliminazione
    // di un item non proprio riservata al curatore di QUESTO museo.
    canCreateItem: contentCreator,
    canEditItem: curatorOfMuseum,
    canDeleteItem: curatorOfMuseum,

    // Musei: crea/elimina solo admin, modifica anche il curatore del museo stesso
    canCreateMuseum: isAdmin,
    canEditMuseum: curatorOfMuseum,
    canDeleteMuseum: isAdmin,

    // Visite: legate a un museo preciso, serve essere curatore o autore DI QUESTO museo
    canCreateVisit: memberOfMuseum,
    canEditVisit: curatorOfMuseum,
    canDeleteVisit: curatorOfMuseum,

    // Solo admin
    canManageUsers: isAdmin,
    canViewAnalytics: isAdmin || curatorOfMuseum,
  };
}

// Controlla se l'utente può modificare un item o una visita specifici (verifica di proprietà: è sempre roba tua, ovunque sia).
export function canEditOwnItem(user: User | null, itemAuthorId: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return user._id === itemAuthorId;
}
