import { MuseumRole, type User } from '@artaround/shared';

/**
 * Servizio Permessi
 *
 * Centralizza i controlli di permesso per la visibilità e le azioni della UI.
 * Deve rispecchiare le regole di policy.util.ts sul backend.
 *
 * Non esiste un CURATOR o un AUTHOR globale: lo si è solo di un museo
 * specifico (User.museumRoles), per questo quasi tutti i permessi qui sotto
 * hanno bisogno del museo "corrente" (es. quello selezionato in UI) per
 * essere calcolati — senza un museo, un utente non admin non può gestire
 * nulla di museo-specifico.
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

/** L'utente è curatore di QUESTO museo specifico (o admin, che può sempre tutto). */
export function isMuseumCurator(user: User | null, museumId?: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!museumId) return false;
  return !!user.museumRoles?.some(
    (mr) => mr.museumId === museumId && mr.role === MuseumRole.CURATOR,
  );
}

/** L'utente è curatore O autore di QUESTO museo specifico (o admin). */
export function isMuseumMember(user: User | null, museumId?: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (!museumId) return false;
  return !!user.museumRoles?.some((mr) => mr.museumId === museumId);
}

/** L'utente è curatore o autore di ALMENO un museo, non importa quale (o admin). */
export function isContentCreator(user: User | null): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return !!user.museumRoles && user.museumRoles.length > 0;
}

/**
 * Ottieni i permessi per un utente, nel contesto di un museo specifico
 * (tipicamente quello selezionato in UI). Senza `museumId`, tutto ciò che
 * dipende da un museo preciso resta negato per chi non è admin.
 */
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

    // Item: creabili da chiunque sia curatore/autore di un museo qualsiasi
    // (un item non dipende da un museo specifico); modifica/eliminazione di
    // un item non proprio riservata al curatore DI QUESTO museo — vedi anche
    // canEditOwnItem per il fallback "è roba tua".
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

/**
 * Controlla se l'utente può modificare un item o una visita specifici
 * (verifica di proprietà: è sempre roba tua, ovunque sia).
 */
export function canEditOwnItem(user: User | null, itemAuthorId: string): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  return user._id === itemAuthorId;
}
