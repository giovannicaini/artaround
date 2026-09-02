import { UserRole, type User } from '@artaround/shared';

// permessi lato UI, devono rispecchiare le regole di role.middleware.ts sul server
export interface PermissionSet {
  canCreateArtwork: boolean;
  canEditArtwork: boolean;
  canDeleteArtwork: boolean;

  canCreateItem: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;

  canCreateMuseum: boolean;
  canEditMuseum: boolean;
  canDeleteMuseum: boolean;

  canCreateVisit: boolean;
  canEditVisit: boolean;
  canDeleteVisit: boolean;

  canManageUsers: boolean;
  canViewAnalytics: boolean;
}

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
    canCreateArtwork: isAdmin || isCurator,
    canEditArtwork: isAdmin || isCurator,
    canDeleteArtwork: isAdmin,

    canCreateItem: isAdmin || isAuthor || isCurator,
    canEditItem: isAdmin || isAuthor || isCurator,
    canDeleteItem: isAdmin || isAuthor || isCurator,

    canCreateMuseum: isAdmin || isCurator,
    canEditMuseum: isAdmin || isCurator,
    canDeleteMuseum: isAdmin,

    canCreateVisit: isAdmin || isAuthor || isCurator,
    canEditVisit: isAdmin || isAuthor || isCurator,
    canDeleteVisit: isAdmin || isAuthor || isCurator,

    canManageUsers: isAdmin,
    canViewAnalytics: isAdmin || isCurator,
  };
}

export function canEditOwnItem(user: User | null, itemAuthorId: string): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  return user._id === itemAuthorId;
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    [UserRole.ADMIN]: 'Amministratore',
    [UserRole.CURATOR]: 'Curatore',
    [UserRole.AUTHOR]: 'Autore',
    [UserRole.VISITOR]: 'Visitatore',
  };
  return names[role] || role;
}

// ruoli richiesti per un'azione, usato nei messaggi di errore
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
