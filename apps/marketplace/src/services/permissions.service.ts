import { UserRole, type User } from '@artaround/shared';

/**
 * Servizio Permessi
 *
 * Centralizza i controlli di permesso per la visibilità e le azioni della UI.
 * Deve rispecchiare le regole di role.middleware.ts sul backend.
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

/**
 * Ottieni i permessi per un utente
 */
export function getPermissions(user: User | null): PermissionSet {
  if (!user) {
    return {
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
  }

  const role = user.role;
  const isAdmin = role === UserRole.ADMIN;
  const isCurator = role === UserRole.CURATOR;
  const isAuthor = role === UserRole.AUTHOR;

  return {
    // Opere: solo ADMIN e CURATOR
    canCreateArtwork: isAdmin || isCurator,
    canEditArtwork: isAdmin || isCurator,
    canDeleteArtwork: isAdmin, // Solo admin può eliminare

    // Item: ogni utente autenticato può creare, ma solo i propri o admin possono modificare/eliminare
    canCreateItem: isAdmin || isAuthor || isCurator,
    canEditItem: isAdmin || isAuthor || isCurator,
    canDeleteItem: isAdmin || isAuthor || isCurator,

    // Musei: solo ADMIN e CURATOR
    canCreateMuseum: isAdmin || isCurator,
    canEditMuseum: isAdmin || isCurator,
    canDeleteMuseum: isAdmin,

    // Visite: ogni autore autenticato può creare
    canCreateVisit: isAdmin || isAuthor || isCurator,
    canEditVisit: isAdmin || isAuthor || isCurator,
    canDeleteVisit: isAdmin || isAuthor || isCurator,

    // Solo admin
    canManageUsers: isAdmin,
    canViewAnalytics: isAdmin || isCurator,
  };
}

/**
 * Controlla se l'utente può modificare un item specifico (verifica di proprietà)
 */
export function canEditOwnItem(user: User | null, itemAuthorId: string): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  return user._id === itemAuthorId;
}

/**
 * Ottieni il nome del ruolo in italiano
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Amministratore',
    [UserRole.CURATOR]: 'Curatore',
    [UserRole.AUTHOR]: 'Autore',
    [UserRole.VISITOR]: 'Visitatore',
  };
  return names[role] || role;
}

/**
 * Ottieni i ruoli richiesti per un'azione (per i messaggi di errore)
 */
export function getRequiredRolesForAction(
  action: 'createArtwork' | 'editArtwork' | 'deleteArtwork' | 'createItem' | 'editItem',
): UserRole[] {
  switch (action) {
    case 'createArtwork':
    case 'editArtwork':
      return [UserRole.ADMIN, UserRole.CURATOR];
    case 'deleteArtwork':
      return [UserRole.ADMIN];
    case 'createItem':
    case 'editItem':
      return [UserRole.ADMIN, UserRole.AUTHOR, UserRole.CURATOR];
    default:
      return [];
  }
}
