import { UserRole, type User } from '@artaround/shared';

/**
 * Permissions Service
 *
 * Centralizes permission checks for UI visibility and actions.
 * Should mirror the backend role.middleware.ts rules.
 */

export interface PermissionSet {
  // Artworks
  canCreateArtwork: boolean;
  canEditArtwork: boolean;
  canDeleteArtwork: boolean;

  // Items (content)
  canCreateItem: boolean;
  canEditItem: boolean;
  canDeleteItem: boolean;

  // Museums
  canCreateMuseum: boolean;
  canEditMuseum: boolean;
  canDeleteMuseum: boolean;

  // Visits
  canCreateVisit: boolean;
  canEditVisit: boolean;
  canDeleteVisit: boolean;

  // Admin only
  canManageUsers: boolean;
  canViewAnalytics: boolean;
}

/**
 * Get permissions for a user
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
    // Artworks: only ADMIN and CURATOR
    canCreateArtwork: isAdmin || isCurator,
    canEditArtwork: isAdmin || isCurator,
    canDeleteArtwork: isAdmin, // Solo admin può eliminare

    // Items: any authenticated user can create, but only own or admin can edit/delete
    canCreateItem: isAdmin || isAuthor || isCurator,
    canEditItem: isAdmin || isAuthor || isCurator,
    canDeleteItem: isAdmin || isAuthor || isCurator,

    // Museums: only ADMIN and CURATOR
    canCreateMuseum: isAdmin || isCurator,
    canEditMuseum: isAdmin || isCurator,
    canDeleteMuseum: isAdmin,

    // Visits: any authenticated author can create
    canCreateVisit: isAdmin || isAuthor || isCurator,
    canEditVisit: isAdmin || isAuthor || isCurator,
    canDeleteVisit: isAdmin || isAuthor || isCurator,

    // Admin only
    canManageUsers: isAdmin,
    canViewAnalytics: isAdmin || isCurator,
  };
}

/**
 * Check if user can edit a specific item (ownership check)
 */
export function canEditOwnItem(user: User | null, itemAuthorId: string): boolean {
  if (!user) return false;
  if (user.role === UserRole.ADMIN) return true;
  return user._id === itemAuthorId;
}

/**
 * Get role display name in Italian
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
 * Get required roles for an action (for error messages)
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
