/*
 * File: /src/services/visitAccess.ts                                                    *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 09/09/2026                                                             *
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

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Visit } from '@artaround/shared';
import { api } from './apiClient';
import { useAuthStore } from '../context/authStore';

// Id delle visite già acquistate dall'utente connesso
export function useOwnedVisitIds(): Set<string> {
  const user = useAuthStore((state) => state.user);
  const { data: purchases } = useQuery({
    queryKey: ['my-purchases'],
    queryFn: () => api.getMyPurchases(),
    enabled: !!user,
  });
  // getMyPurchases popola visitId con la visita intera (VisitPurchaseWithVisit).
  return useMemo(
    () => new Set((purchases || []).filter((p) => p.visitId).map((p) => p.visitId._id)),
    [purchases],
  );
}

// Visita gratis o già acquistata
export function canStartVisit(visit: Visit, ownedVisitIds: Set<string>): boolean {
  return !!visit.metadata?.isFree || ownedVisitIds.has(visit._id);
}
