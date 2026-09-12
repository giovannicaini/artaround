/*
 * File: VisitDetailPage.tsx                                                             *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 12/09/2026                                                             *
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

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Users, Star, Ticket, Accessibility } from 'lucide-react';
import { api, ApiError } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { useLanguageLevelMeta } from '../services/useLanguageLevelMeta';
import { useOwnedVisitIds } from '../services/visitAccess';
import { localizedField, format } from '../services/i18n';
import { loadVisitProgress } from '../services/visitProgress';
import {
  Button,
  Sheet,
  SectionHeader,
  IconRowCard,
  StickyHeader,
  LoadingState,
  ErrorState,
  UserAvatar,
} from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { VisitPriceBadge } from '../components/VisitPriceBadge';
import { PurchasePrompt } from '../components/PurchasePrompt';

export default function VisitDetailPage() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const user = useAuthStore((state) => state.user);
  const language = useI18nStore((state) => state.language);
  const t = useT();
  const LEVEL_META = useLanguageLevelMeta();
  const ownedVisitIds = useOwnedVisitIds();
  // Card info pratiche troncata a due righe — apre qui il testo completo invece di perderlo.
  const [expandedInfo, setExpandedInfo] = useState<{ label: string; value: string } | null>(null);

  const {
    data: visit,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['visit', visitId],
    queryFn: () => api.getVisit(visitId!),
    enabled: !!visitId,
  });

  // Progresso salvato su questo dispositivo, solo se appartiene a questa stessa visita.
  const [progress] = useState(() => loadVisitProgress());
  const resumable = progress && visit && progress.visitId === visit._id ? progress : null;

  if (isLoading) {
    return (
      <div className="h-full bg-surface-950">
        <LoadingState message={t('Cerco la visita...')} />
      </div>
    );
  }

  // Visita a pagamento non acquistata: il server restituisce solo titolo/foto/prezzo,
  // non descrizione o durata — l'anteprima mostra solo quello, più l'invito all'acquisto.
  if (error instanceof ApiError && error.code === 'PURCHASE_REQUIRED') {
    const info = error.data as { title?: string; coverImage?: string; price?: number } | undefined;
    return (
      <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
        <StickyHeader maxWidthClassName="lg:max-w-3xl">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-surface-300 hover:bg-surface-700 transition-colors"
            aria-label={t('Torna indietro')}
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <span className="font-display text-sm font-semibold text-surface-50">
            {t('Dettagli Visita')}
          </span>
          <UserAvatar
            username={user?.username}
            onClick={() => navigate('/account')}
            label={t('Account')}
          />
        </StickyHeader>

        {info?.coverImage && (
          <div className="lg:max-w-3xl lg:mx-auto lg:px-8 lg:pt-6">
            <div className="overflow-hidden lg:rounded-3xl lg:bg-surface-900">
              <img
                src={info.coverImage}
                alt=""
                className="w-full h-48 object-cover lg:h-auto lg:max-h-[28rem] lg:object-contain"
              />
            </div>
          </div>
        )}

        <div className="lg:max-w-3xl lg:mx-auto px-5 py-6 lg:px-8">
          <h1 className="font-display text-2xl lg:text-4xl font-bold text-surface-50 leading-tight mb-6">
            {info?.title}
          </h1>
          <PurchasePrompt title={info?.title || ''} price={info?.price || 0} />
        </div>
      </div>
    );
  }

  if (isError || !visit) {
    return (
      <div className="h-full bg-surface-950">
        <ErrorState
          message={error instanceof Error ? error.message : t('Impossibile caricare la visita.')}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Se siamo arrivati qui con la visita intera (non l'errore PURCHASE_REQUIRED sopra),
  // è per forza avviabile: gratis, o a pagamento già posseduta.
  const owned = ownedVisitIds.has(visit._id);
  const visitTitle = localizedField(language, visit.title, visit.titleTranslations);

  const practicalInfo = [
    visit.generalInfo?.openingHours && {
      icon: Clock,
      label: t('Orari'),
      value: visit.generalInfo.openingHours,
    },
    (visit.generalInfo?.costs || visit.generalInfo?.ticketInfo) && {
      icon: Ticket,
      label: t('Biglietti'),
      value: (visit.generalInfo.costs || visit.generalInfo.ticketInfo) as string,
    },
    visit.generalInfo?.accessibility && {
      icon: Accessibility,
      label: t('Accessibilità'),
      value: visit.generalInfo.accessibility,
    },
  ].filter((v): v is { icon: typeof Clock; label: string; value: string } => Boolean(v));

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950 pb-28">
      <StickyHeader maxWidthClassName="lg:max-w-3xl">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-surface-300 hover:bg-surface-700 transition-colors"
          aria-label={t('Torna indietro')}
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <span className="font-display text-sm font-semibold text-surface-50">
          {t('Dettagli Visita')}
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher languages={visit.metadata?.supportedLanguages} menuAlign="right" />
          <UserAvatar
            username={user?.username}
            onClick={() => navigate('/account')}
            label={t('Account')}
          />
        </div>
      </StickyHeader>

      {visit.coverImage && (
        <div className="lg:max-w-3xl lg:mx-auto lg:px-8 lg:pt-6">
          <div className="overflow-hidden lg:rounded-3xl lg:bg-surface-900">
            <img
              src={visit.coverImage}
              alt=""
              className="w-full h-48 object-cover lg:h-auto lg:max-h-[28rem] lg:object-contain"
            />
          </div>
        </div>
      )}

      <div className="lg:max-w-3xl lg:mx-auto px-5 py-6 lg:px-8">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="font-display text-2xl lg:text-4xl font-bold text-surface-50 leading-tight">
            {visitTitle}
          </h1>
          <VisitPriceBadge visit={visit} owned={owned} />
        </div>

        {visit.targetAudience?.languageLevels?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {visit.targetAudience.languageLevels.map((level) => (
              <span
                key={level}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-800 text-surface-300"
              >
                {LEVEL_META[level].emoji} {LEVEL_META[level].label}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-surface-400 mb-8">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {visit.metadata?.estimatedDuration} {t('min')}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {visit.metadata?.artworksCount} {t('opere')}
          </span>
          {visit.metadata?.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-brand-400 text-brand-400" />
              <span className="font-medium text-surface-300">{visit.metadata.rating}</span>
            </span>
          )}
        </div>

        <section className="mb-8">
          <SectionHeader title={t('Descrizione')} className="mb-3" />
          <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-line">
            {localizedField(language, visit.description, visit.descriptionTranslations)}
          </p>
        </section>

        {practicalInfo.length > 0 && (
          <section className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {practicalInfo.map(({ icon: Icon, label, value }) => (
              <IconRowCard
                key={label}
                icon={<Icon className="w-[18px] h-[18px] text-brand-300" />}
                label={label}
                value={value}
                onClick={() => setExpandedInfo({ label, value })}
              />
            ))}
          </section>
        )}

        {visit.generalInfo?.tips && visit.generalInfo.tips.length > 0 && (
          <section className="mb-8">
            <SectionHeader title={t('Consigli utili')} className="mb-3" />
            <ul className="space-y-2">
              {visit.generalInfo.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                  <span className="text-brand-400 mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {expandedInfo && (
        <Sheet open onClose={() => setExpandedInfo(null)} title={expandedInfo.label}>
          <p className="text-sm text-surface-200 whitespace-pre-line leading-relaxed">
            {expandedInfo.value}
          </p>
        </Sheet>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem_+_var(--safe-area-inset-bottom))] bg-surface-950/95 backdrop-blur border-t border-surface-800">
        <div className="lg:max-w-3xl lg:mx-auto">
          <Button variant="primary" block onClick={() => navigate(`/visit/${visit._id}/play`)}>
            {resumable
              ? format(t('Riprendi da tappa {step}'), { step: String(resumable.stepIndex + 1) })
              : t('Inizia la visita')}
          </Button>
        </div>
      </div>
    </div>
  );
}
