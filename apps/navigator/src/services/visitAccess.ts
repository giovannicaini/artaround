import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Visit } from '@artaround/shared';
import { api } from './apiClient';
import { useAuthStore } from '../context/authStore';

/** Id delle visite a pagamento già acquistate dall'utente loggato — vuoto se non loggato. */
export function useOwnedVisitIds(): Set<string> {
  const user = useAuthStore((state) => state.user);
  const { data: purchases } = useQuery({
    queryKey: ['my-purchases'],
    queryFn: () => api.getMyPurchases(),
    enabled: !!user,
  });
  // getMyPurchases popola visitId con la visita intera (VisitPurchaseWithVisit).
  return useMemo(() => new Set((purchases || []).map((p) => p.visitId._id)), [purchases]);
}

/** Se la visita è avviabile subito — gratis, o a pagamento già posseduta. */
export function canStartVisit(visit: Visit, ownedVisitIds: Set<string>): boolean {
  return !!visit.metadata?.isFree || ownedVisitIds.has(visit._id);
}
