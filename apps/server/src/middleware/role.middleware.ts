import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';
import { UserRole, ContextualRole, ResourceType, RoleAssignment } from '@artaround/shared';

export const roleMiddleware = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Autenticazione richiesta. Effettua il login.',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      const roleNames = allowedRoles.map((r) => r.toLowerCase()).join(' o ');
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Non hai i permessi per eseguire questa operazione. Ruolo richiesto: ${roleNames}.`,
        },
      });
      return;
    }

    next();
  };
};

/**
 * Middleware che controlla se l'utente è admin OPPURE ha un ruolo contestuale
 * specifico su una risorsa. Usato per la gestione musei, dove i curatori
 * possono modificare i musei a cui sono assegnati. Recupera l'utente dal
 * database per controllare roleAssignments.
 */
export const resourceRoleMiddleware = (
  resourceType: ResourceType,
  resourceIdParam: string,
  ...allowedContextualRoles: ContextualRole[]
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Autenticazione richiesta. Effettua il login.',
        },
      });
      return;
    }

    // Gli admin possono sempre accedere
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // Recupera l'utente dal database per controllare roleAssignments
    try {
      const { User } = await import('../models/index.js');
      const user = await User.findById(req.user.id);

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Utente non trovato.',
          },
        });
        return;
      }

      // Controlla l'assegnazione di ruolo contestuale
      const resourceId = req.params[resourceIdParam];
      const hasContextualRole = user.roleAssignments?.some(
        (assignment: RoleAssignment) =>
          assignment.resourceType === resourceType &&
          assignment.resourceId === resourceId &&
          allowedContextualRoles.includes(assignment.role),
      );

      if (hasContextualRole) {
        next();
        return;
      }
    } catch (error) {
      console.error('Error checking resource role:', error);
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Non hai i permessi per modificare questa risorsa.',
      },
    });
  };
};
