/*
 * File: MuseumPage.tsx                                                                  *
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

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Users,
  Play,
  ShoppingBag,
  Ticket,
  Accessibility,
  MapPin,
  Map as MapIcon,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { useLanguageLevelMeta } from '../services/useLanguageLevelMeta';
import { useNavigatorConfigStore } from '../context/navigatorConfigStore';
import { localizedField } from '../services/i18n';
import { useOwnedVisitIds } from '../services/visitAccess';
import { LanguageLevel, type Visit, type MuseumService } from '@artaround/shared';
import {
  Chip,
  LoadingState,
  ErrorState,
  EmptyState,
  PressableCard,
  Sheet,
  IconRowCard,
  UserAvatar,
  SectionHeader,
  Link,
  StickyHeader,
} from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { VisitPriceBadge } from '../components/VisitPriceBadge';
import { ServiceGrid } from '../components/ServiceGrid';
import MapView from '../components/MapView';
import { buildMuseumMap } from '../services/mapRoute';
import { ServiceDetailSheet } from '../components/ServiceDetailSheet';

/** Pagina museo: copertina, info pratiche, una visita in evidenza, poi l'elenco filtrabile. */
export default function MuseumPage() {
  const navigate = useNavigate();
  const { museumId } = useParams();
  const user = useAuthStore((state) => state.user);
  const language = useI18nStore((state) => state.language);
  const t = useT();
  const kioskMuseumId = useNavigatorConfigStore((state) => state.kioskMuseumId);
  const isKioskLocked = !!kioskMuseumId && kioskMuseumId === museumId;
  const [filterLevel, setFilterLevel] = useState<LanguageLevel | null>(null);
  const [filterPrice, setFilterPrice] = useState<'free' | 'paid' | null>(null);
  const [filterDuration, setFilterDuration] = useState<'short' | 'medium' | 'long' | null>(null);
  const [filterInterests, setFilterInterests] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedInfo, setExpandedInfo] = useState<{ label: string; value: string } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapFocusMarkerId, setMapFocusMarkerId] = useState<string | undefined>();
  const [selectedService, setSelectedService] = useState<MuseumService | null>(null);
  const [showMapAndServices, setShowMapAndServices] = useState(false);

  const LEVEL_META = useLanguageLevelMeta();

  const DURATION_META: Record<'short' | 'medium' | 'long', { emoji: string; label: string }> = {
    short: { emoji: '⚡', label: t('Fino a 30 min') },
    medium: { emoji: '🕒', label: t('30-60 min') },
    long: { emoji: '⏳', label: t('Oltre 60 min') },
  };

  function durationBucket(minutes?: number): 'short' | 'medium' | 'long' | null {
    if (minutes == null) return null;
    if (minutes <= 30) return 'short';
    if (minutes <= 60) return 'medium';
    return 'long';
  }

  const { data: museum, isLoading: museumLoading } = useQuery({
    queryKey: ['museum', museumId],
    queryFn: () => api.getMuseum(museumId!),
    enabled: !!museumId,
  });

  // Titolo/foto/descrizione delle opere per i marker della mappa — richieste solo
  // all'apertura della mappa (non servono al resto della pagina).
  const { data: museumArtworks } = useQuery({
    queryKey: ['museum-artworks', museum?.wikidataId],
    queryFn: () => api.getArtworksByMuseum(museum!.wikidataId),
    enabled: showMap && !!museum?.wikidataId,
  });

  const artworkInfo = useMemo(
    () =>
      Object.fromEntries(
        (museumArtworks || []).map((artwork) => [
          artwork.wikidataId,
          { title: artwork.title, image: artwork.image, description: artwork.description },
        ]),
      ),
    [museumArtworks],
  );

  const {
    data: visits,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['visits', museumId],
    queryFn: () => api.getVisits(museumId),
    enabled: !!museumId,
  });

  const ownedVisitIds = useOwnedVisitIds();

  function handleSelectVisit(visit: Visit) {
    navigate(`/visit/${visit._id}`);
  }

  // Interessi effettivamente presenti tra le visite di questo museo
  const availableInterests = useMemo(
    () =>
      [...new Set((visits || []).flatMap((v) => v.targetAudience?.interests || []))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [visits],
  );

  const activeFilterCount =
    (filterLevel ? 1 : 0) +
    (filterPrice ? 1 : 0) +
    (filterDuration ? 1 : 0) +
    filterInterests.length;

  function resetFilters() {
    setFilterLevel(null);
    setFilterPrice(null);
    setFilterDuration(null);
    setFilterInterests([]);
  }

  const filteredVisits = (visits || [])
    .filter((v) => !filterLevel || v.targetAudience?.languageLevels?.includes(filterLevel))
    .filter((v) => {
      if (!filterPrice) return true;
      return filterPrice === 'free' ? v.metadata?.isFree : !v.metadata?.isFree;
    })
    .filter(
      (v) => !filterDuration || durationBucket(v.metadata?.estimatedDuration) === filterDuration,
    )
    .filter(
      (v) =>
        filterInterests.length === 0 ||
        filterInterests.some((interest) => v.targetAudience?.interests?.includes(interest)),
    );

  const practicalInfo = [
    museum?.services?.openingHours && {
      icon: Clock,
      label: t('Orari'),
      value: localizedField(
        language,
        museum.services.openingHours,
        museum.services.openingHoursTranslations,
      ),
    },
    museum?.services?.ticketInfo && {
      icon: Ticket,
      label: t('Biglietti'),
      value: localizedField(
        language,
        museum.services.ticketInfo,
        museum.services.ticketInfoTranslations,
      ),
    },
    museum?.services?.accessibility && {
      icon: Accessibility,
      label: t('Accessibilità'),
      value: museum.services.accessibility,
    },
  ].filter((v): v is { icon: typeof Clock; label: string; value: string } => Boolean(v));

  const museumMap = useMemo(() => (museum ? buildMuseumMap(museum) : null), [museum]);

  const activeServices = useMemo(
    () => (museum?.services?.services || []).filter((service) => service.active),
    [museum],
  );

  //Url google maps in base alle coordinate salvate nel marketplace.
  const mapsUrl = useMemo(() => {
    const location = museum?.location;
    if (!location) return null;
    if (location.coordinates?.lat && location.coordinates?.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${location.coordinates.lat},${location.coordinates.lng}`;
    }
    const query = [location.address, location.city].filter(Boolean).join(', ');
    return query
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      : null;
  }, [museum]);

  if (isLoading || museumLoading) {
    return (
      <div className="h-full bg-surface-950">
        <LoadingState message={t('Cerco le visite del museo...')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full bg-surface-950">
        <ErrorState
          message={error instanceof Error ? error.message : t('Impossibile caricare le visite.')}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const museumName = museum ? localizedField(language, museum.name, museum.nameTranslations) : '';
  const hasPhoto = !!museum?.images?.[0];

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
      {/* Blocco: barra superiore*/}
      <StickyHeader>
        {isKioskLocked ? (
          <div className="w-9 h-9" />
        ) : (
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full bg-surface-800 flex items-center justify-center text-surface-300 hover:bg-surface-700 transition-colors"
            aria-label={t('Torna indietro')}
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
        )}
        <span className="font-display text-sm font-semibold text-surface-50">
          {t('Dettagli Museo')}
        </span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher languages={museum?.activeLanguages} menuAlign="right" />
          <UserAvatar
            username={user?.username}
            onClick={() => navigate('/account')}
            label={t('Account')}
          />
        </div>
      </StickyHeader>

      {/* Blocco: copertina */}
      {hasPhoto && (
        <div className="lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-6">
          <div className="overflow-hidden lg:rounded-3xl lg:bg-surface-900">
            <img
              src={museum!.images![0]}
              alt={museumName}
              className="w-full h-48 object-cover lg:h-auto lg:max-h-[28rem] lg:object-contain"
            />
          </div>
        </div>
      )}

      <div className="lg:max-w-6xl lg:mx-auto">
        <main className="px-5 py-6 lg:px-8 lg:py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl lg:text-5xl font-bold text-surface-50 mb-1.5 max-w-2xl">
              {museumName}
            </h1>
            <p className="text-sm lg:text-base text-surface-400">
              {museum?.location?.address}
              {museum?.location?.address && museum?.location?.city ? ', ' : ''}
              {museum?.location?.city}
            </p>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-full backdrop-blur
                  border text-xs font-medium transition-colors bg-surface-800/80 border-surface-700/60
                  text-surface-200 hover:text-brand-300 hover:border-brand-500/30"
              >
                <MapPin className="w-3.5 h-3.5" />
                {t('Indicazioni stradali')}
              </a>
            )}
          </div>

          {/* Blocco: mappa del museo e servizi*/}
          {(museumMap || activeServices.length > 0) && (
            <section className="mb-8">
              <IconRowCard
                icon={<MapIcon className="w-[18px] h-[18px] text-brand-300" />}
                label={t('Mappa e servizi')}
                onClick={() => setShowMapAndServices(true)}
              />
            </section>
          )}

          {/* Blocco: info pratiche */}
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

          {expandedInfo && (
            <Sheet open onClose={() => setExpandedInfo(null)} title={expandedInfo.label}>
              <p className="text-sm text-surface-200 whitespace-pre-line leading-relaxed">
                {expandedInfo.value}
              </p>
            </Sheet>
          )}

          <Sheet
            open={showMapAndServices}
            onClose={() => setShowMapAndServices(false)}
            title={t('Mappa e servizi')}
          >
            <div className="space-y-4">
              {museumMap && (
                <IconRowCard
                  icon={<MapIcon className="w-[18px] h-[18px] text-brand-300" />}
                  label={t('Mappa del museo')}
                  onClick={() => {
                    setShowMapAndServices(false);
                    setShowMap(true);
                  }}
                />
              )}
              <ServiceGrid
                services={activeServices}
                onSelect={(service) => {
                  setShowMapAndServices(false);
                  setSelectedService(service);
                }}
              />
            </div>
          </Sheet>

          <Sheet open={showFilters} onClose={() => setShowFilters(false)} title={t('Filtri')}>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-surface-300 mb-2">{t('Livello')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.values(LanguageLevel).map((level) => (
                    <Chip
                      key={level}
                      selected={filterLevel === level}
                      onClick={() => setFilterLevel(filterLevel === level ? null : level)}
                    >
                      {LEVEL_META[level].emoji} {LEVEL_META[level].label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-surface-300 mb-2">{t('Prezzo')}</p>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    selected={filterPrice === 'free'}
                    onClick={() => setFilterPrice(filterPrice === 'free' ? null : 'free')}
                  >
                    🎁 {t('Gratis')}
                  </Chip>
                  <Chip
                    selected={filterPrice === 'paid'}
                    onClick={() => setFilterPrice(filterPrice === 'paid' ? null : 'paid')}
                  >
                    💳 {t('A pagamento')}
                  </Chip>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-surface-300 mb-2">{t('Durata')}</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DURATION_META) as Array<'short' | 'medium' | 'long'>).map(
                    (bucket) => (
                      <Chip
                        key={bucket}
                        selected={filterDuration === bucket}
                        onClick={() => setFilterDuration(filterDuration === bucket ? null : bucket)}
                      >
                        {DURATION_META[bucket].emoji} {DURATION_META[bucket].label}
                      </Chip>
                    ),
                  )}
                </div>
              </div>

              {availableInterests.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-surface-300 mb-2">{t('Interessi')}</p>
                  <div className="flex flex-wrap gap-2">
                    {availableInterests.map((interest) => (
                      <Chip
                        key={interest}
                        selected={filterInterests.includes(interest)}
                        onClick={() =>
                          setFilterInterests((prev) =>
                            prev.includes(interest)
                              ? prev.filter((i) => i !== interest)
                              : [...prev, interest],
                          )
                        }
                      >
                        {interest}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="text-brand-400 text-sm font-medium hover:underline"
                >
                  {t('Cancella filtri')}
                </button>
              )}
            </div>
          </Sheet>

          <ServiceDetailSheet
            service={selectedService}
            onClose={() => setSelectedService(null)}
            onViewOnMap={(markerId) => {
              setMapFocusMarkerId(markerId);
              setShowMap(true);
            }}
          />

          {/* Blocco: descrizione museo */}
          {museum?.description && (
            <section className="mb-9">
              <SectionHeader title={t('Descrizione')} className="mb-3 text-xl" />
              <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-line">
                {localizedField(language, museum.description, museum.descriptionTranslations)}
              </p>
            </section>
          )}

          {/* Blocco: tutte le visite, filtrabili */}
          <section className="mb-9">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 className="font-display text-xl font-semibold text-surface-50">
                {t('Tutte le visite')}
              </h2>
              <button
                onClick={() => setShowFilters(true)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium bg-surface-800 border border-surface-700 text-surface-300 hover:border-surface-500 hover:text-surface-100 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t('Filtri')}
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full gradient-aurora text-white text-xs font-bold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {!visits || visits.length === 0 ? (
              <EmptyState
                icon={<Play />}
                title={t('Nessuna visita disponibile')}
                message={t('Questo museo non ha ancora visite pubblicate.')}
              />
            ) : filteredVisits.length === 0 ? (
              <EmptyState
                icon={<Play />}
                title={t('Nessuna visita per questo filtro')}
                action={
                  <button
                    onClick={resetFilters}
                    className="text-brand-400 text-sm font-medium hover:underline"
                  >
                    {t('Mostra tutte')}
                  </button>
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredVisits.map((visit) => {
                  const owned = ownedVisitIds.has(visit._id);
                  return (
                    <PressableCard
                      key={visit._id}
                      onClick={() => handleSelectVisit(visit)}
                      className="p-5 lg:p-6"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-display font-semibold text-surface-50 text-lg leading-tight">
                          {localizedField(language, visit.title, visit.titleTranslations)}
                        </h3>
                        <VisitPriceBadge visit={visit} owned={owned} />
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {visit.targetAudience?.languageLevels?.map((level) => (
                          <span
                            key={level}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-800 text-surface-300"
                          >
                            {LEVEL_META[level].emoji} {LEVEL_META[level].label}
                          </span>
                        ))}
                      </div>

                      <p className="text-sm text-surface-400 mb-4 line-clamp-2 min-h-[2.5rem]">
                        {localizedField(language, visit.description, visit.descriptionTranslations)}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-surface-800">
                        <div className="flex items-center gap-4 text-xs text-surface-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {visit.metadata?.estimatedDuration} {t('min')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {visit.metadata?.artworksCount} {t('opere')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full gradient-aurora text-white font-bold text-xs">
                          <Play className="w-3.5 h-3.5" fill="currentColor" />
                          <span>{owned ? t('Continua') : t('Inizia')}</span>
                        </div>
                      </div>
                    </PressableCard>
                  );
                })}
              </div>
            )}
          </section>

          <div className="mt-8 pt-6 border-t border-surface-800">
            <Link
              icon={<ShoppingBag className="w-5 h-5" />}
              label={t('Scopri altre visite nel Marketplace')}
              href="/marketplace/"
            />
          </div>
        </main>

        <div className="h-8 safe-bottom" />
      </div>

      {/* Mappa del museo, non legata a nessuna visita. */}
      {showMap && museumMap && (
        <MapView
          map={museumMap}
          inVisit={false}
          artworkInfo={artworkInfo}
          focusMarkerId={mapFocusMarkerId}
          onClose={() => {
            setShowMap(false);
            setMapFocusMarkerId(undefined);
          }}
        />
      )}
    </div>
  );
}
