import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Users,
  Star,
  Play,
  ShoppingBag,
  Ticket,
  Accessibility,
  Sparkles,
  UserCircle,
  ChevronRight,
  MapPin,
  Map as MapIcon,
} from 'lucide-react';
import { api } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { useNavigatorConfigStore } from '../context/navigatorConfigStore';
import { interestAffinity } from '../services/personalization';
import { localizedField } from '../services/i18n';
import { useOwnedVisitIds, canStartVisit } from '../services/visitAccess';
import { LanguageLevel, MARKER_TYPE_META, type Visit, type MuseumService } from '@artaround/shared';
import {
  IconTile,
  Chip,
  LoadingState,
  ErrorState,
  EmptyState,
  PressableCard,
  LanguageSwitcher,
  Sheet,
  PurchasePrompt,
  VisitPriceBadge,
} from '../components/ui';
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
  // Card info pratiche (Orari/Biglietti/Accessibilità) troncata a due righe
  // nella griglia — apre qui il testo completo invece di perderlo.
  const [expandedInfo, setExpandedInfo] = useState<{ label: string; value: string } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapFocusMarkerId, setMapFocusMarkerId] = useState<string | undefined>();
  // Scheda di dettaglio di un servizio del museo (bar, bagni...), aperta dalla griglia servizi.
  const [selectedService, setSelectedService] = useState<MuseumService | null>(null);

  const LEVEL_META: Record<LanguageLevel, { emoji: string; label: string }> = {
    [LanguageLevel.CHILDREN]: { emoji: '👶', label: t('Bambini') },
    [LanguageLevel.ELEMENTARY]: { emoji: '🌱', label: t('Base') },
    [LanguageLevel.MEDIUM]: { emoji: '🌿', label: t('Intermedio') },
    [LanguageLevel.SPECIALIST]: { emoji: '🌳', label: t('Avanzato') },
  };

  const { data: museum, isLoading: museumLoading } = useQuery({
    queryKey: ['museum', museumId],
    queryFn: () => api.getMuseum(museumId!),
    enabled: !!museumId,
  });

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
  // Visita a pagamento non posseduta su cui si è cliccato — apre l'invito
  // all'acquisto invece di navigare al player (vedi handleSelectVisit).
  const [purchasePromptVisit, setPurchasePromptVisit] = useState<Visit | null>(null);

  const interests = user?.preferences?.interests;
  const spotlight = useMemo(() => {
    if (!visits || !interests?.length) return null;
    const scored = visits
      .map((visit) => ({
        visit,
        score: interestAffinity(interests, visit.targetAudience?.interests),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored[0]?.visit ?? null;
  }, [visits, interests]);

  function handleSelectVisit(visit: Visit) {
    if (!canStartVisit(visit, ownedVisitIds)) {
      setPurchasePromptVisit(visit);
      return;
    }
    navigate(`/visit/${visit._id}`);
  }

  const filteredVisits = (
    filterLevel
      ? (visits || []).filter((v) => v.targetAudience?.languageLevels?.includes(filterLevel))
      : visits || []
  ).filter((v) => v._id !== spotlight?._id);

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
      {/* ── Blocco: copertina ──────────────────────────────────── */}
      <header className="relative">
        <div className="h-64 lg:h-80 bg-surface-900 relative overflow-hidden">
          {hasPhoto && (
            <>
              <img
                src={museum!.images![0]}
                alt={museumName}
                className="w-full h-full object-cover opacity-45"
              />
              {/* Scrim fisso, non legato al tema: deve scurire una foto reale in ogni configurazione. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-brand-900/20" />
            </>
          )}

          <div className="absolute top-0 left-0 right-0 safe-top">
            <div className="flex items-center justify-between px-4 lg:px-8 py-4">
              {isKioskLocked ? (
                <div />
              ) : (
                <IconTile
                  icon={<ArrowLeft />}
                  variant="glass"
                  label={t('Torna indietro')}
                  onClick={() => navigate('/')}
                />
              )}
              <div className="flex items-center gap-2">
                <LanguageSwitcher languages={museum?.activeLanguages} variant="glass" />
                <IconTile
                  icon={<UserCircle />}
                  variant="glass"
                  label={t('Account')}
                  onClick={() => navigate('/account')}
                />
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
            <div className="lg:max-w-6xl lg:mx-auto">
              <h1
                className={`font-display text-3xl lg:text-5xl font-bold mb-1.5 max-w-2xl ${hasPhoto ? 'text-white' : 'text-surface-50'}`}
              >
                {museumName}
              </h1>
              <p
                className={`text-sm lg:text-base ${hasPhoto ? 'text-white/70' : 'text-surface-400'}`}
              >
                {museum?.location?.address}
                {museum?.location?.address && museum?.location?.city ? ', ' : ''}
                {museum?.location?.city}
              </p>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-full backdrop-blur
                    border text-xs font-medium transition-colors ${
                      hasPhoto
                        ? 'bg-black/40 border-white/20 text-white/90 hover:text-white hover:border-white/40'
                        : 'bg-surface-800/80 border-surface-700/60 text-surface-200 hover:text-brand-300 hover:border-brand-500/30'
                    }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {t('Apri in Google Maps')}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="lg:max-w-6xl lg:mx-auto">
        <main className="px-5 py-6 lg:px-8 lg:py-8">
          {/* ── Blocco: mappa del museo e servizi ─────────────────── */}
          {(museumMap || activeServices.length > 0) && (
            <section className="mb-8">
              {museumMap && (
                <PressableCard
                  onClick={() => setShowMap(true)}
                  className="p-4 flex items-center gap-3 mb-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-500/[.12] flex items-center justify-center flex-shrink-0">
                    <MapIcon className="w-[18px] h-[18px] text-brand-300" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-surface-200">
                    {t('Mappa del museo')}
                  </span>
                  <ChevronRight className="w-4 h-4 text-surface-600 flex-shrink-0" />
                </PressableCard>
              )}
              {activeServices.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {activeServices.map((service) => (
                    <button
                      key={service.type}
                      onClick={() => setSelectedService(service)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-900
                        border border-surface-800 text-surface-300 hover:border-brand-500/30
                        hover:text-brand-300 transition-colors"
                    >
                      <span className="text-2xl">{MARKER_TYPE_META[service.type].icon}</span>
                      <span className="text-xs font-medium text-center leading-tight">
                        {MARKER_TYPE_META[service.type].label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Blocco: info pratiche ────────────────────────────── */}
          {practicalInfo.length > 0 && (
            <section className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {practicalInfo.map(({ icon: Icon, label, value }) => (
                <PressableCard
                  key={label}
                  className="p-4 flex items-start gap-3"
                  onClick={() => setExpandedInfo({ label, value })}
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-500/[.12] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-[18px] h-[18px] text-brand-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.68rem] font-bold uppercase tracking-wide text-surface-500 mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm text-surface-200 line-clamp-2">{value}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-surface-600 flex-shrink-0 mt-0.5" />
                </PressableCard>
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

          {purchasePromptVisit && (
            <Sheet open onClose={() => setPurchasePromptVisit(null)}>
              <PurchasePrompt
                title={localizedField(
                  language,
                  purchasePromptVisit.title,
                  purchasePromptVisit.titleTranslations,
                )}
                price={purchasePromptVisit.metadata?.price || 0}
              />
            </Sheet>
          )}

          <ServiceDetailSheet
            service={selectedService}
            onClose={() => setSelectedService(null)}
            onViewOnMap={(markerId) => {
              setMapFocusMarkerId(markerId);
              setShowMap(true);
            }}
          />

          {/* ── Blocco: descrizione museo ──────────────────────────
              Non compariva da nessun'altra parte: la homepage rimanda qui
              solo con un'anteprima troncata (vedi HomePage.tsx). */}
          {museum?.description && (
            <section className="mb-9">
              <h2 className="font-display text-base font-semibold text-surface-50 mb-3">
                {t('Descrizione')}
              </h2>
              <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-line">
                {localizedField(language, museum.description, museum.descriptionTranslations)}
              </p>
            </section>
          )}

          {/* ── Blocco: visita in evidenza per te ─────────────────── */}
          {spotlight && (
            <section className="mb-9">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <h2 className="font-display text-base font-semibold text-surface-50">
                  {t('Consigliata per te')}
                </h2>
              </div>
              <PressableCard
                onClick={() => handleSelectVisit(spotlight)}
                className="relative overflow-hidden p-6 border-brand-500/30"
              >
                <div className="absolute -top-16 -right-16 w-48 h-48 gradient-aurora opacity-20 blur-3xl rounded-full" />
                <div className="relative">
                  <h3 className="font-display font-bold text-surface-50 text-xl mb-2 max-w-md">
                    {localizedField(language, spotlight.title, spotlight.titleTranslations)}
                  </h3>
                  <p className="text-sm text-surface-400 mb-4 max-w-md line-clamp-2">
                    {localizedField(
                      language,
                      spotlight.description,
                      spotlight.descriptionTranslations,
                    )}
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full gradient-aurora text-white font-bold text-sm">
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    {t('Inizia questa visita')}
                  </div>
                </div>
              </PressableCard>
            </section>
          )}

          {/* ── Blocco: tutte le visite, filtrabili ───────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <h2 className="font-display text-xl font-semibold text-surface-50">
              {t('Tutte le visite')}
            </h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                  onClick={() => setFilterLevel(null)}
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
                        {visit.metadata?.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-brand-400 text-brand-400" />
                            <span className="font-medium text-surface-300">
                              {visit.metadata.rating}
                            </span>
                          </span>
                        )}
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

          <div className="mt-8 pt-6 border-t border-surface-800">
            <a
              href="/marketplace"
              className="flex items-center justify-center gap-2.5 py-3.5 px-5 bg-surface-900 border border-surface-800 rounded-xl text-surface-400 hover:text-brand-300 hover:border-brand-500/30 transition-all"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="font-medium">{t('Scopri altre visite nel Marketplace')}</span>
            </a>
          </div>
        </main>

        <div className="h-8 safe-bottom" />
      </div>

      {/* Mappa del museo, non legata a nessuna visita. */}
      {showMap && museumMap && (
        <MapView
          map={museumMap}
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
