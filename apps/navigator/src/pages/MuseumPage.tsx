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
  CheckCircle2,
  Ticket,
  Accessibility,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import { useI18nStore } from '../stores/i18nStore';
import { useT } from '../hooks/useT';
import { useMuseumTheme } from '../hooks/useMuseumTheme';
import { interestAffinity } from '../lib/personalization';
import { localizedField } from '../lib/i18n';
import { LanguageLevel, type Visit } from '@artaround/shared';
import {
  IconTile,
  Chip,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  PressableCard,
  Card,
  LanguageSwitcher,
} from '../components/ui';

/**
 * Museo come sequenza di blocchi con scopi diversi — copertina, info
 * pratiche, una visita in evidenza (se combacia con gli interessi
 * salvati), poi l'elenco completo filtrabile — non un'unica lista.
 */
export default function MuseumPage() {
  const navigate = useNavigate();
  const { museumId } = useParams();
  const user = useAuthStore((state) => state.user);
  const language = useI18nStore((state) => state.language);
  const t = useT();
  const { config } = useMuseumTheme(museumId);
  const [filterLevel, setFilterLevel] = useState<LanguageLevel | null>(null);

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

  const { data: purchases } = useQuery({
    queryKey: ['my-purchases'],
    queryFn: () => api.getMyPurchases(),
    enabled: !!user,
  });
  const ownedVisitIds = useMemo(
    () => new Set((purchases || []).map((p) => p.visitId)),
    [purchases],
  );

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

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
      {/* ── Blocco: copertina ──────────────────────────────────── */}
      <header className="relative">
        <div className="h-64 lg:h-80 bg-surface-900 relative overflow-hidden">
          {museum?.images?.[0] && (
            <img
              src={museum.images[0]}
              alt={museumName}
              className="w-full h-full object-cover opacity-45"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/50 to-brand-900/20" />

          <div className="absolute top-0 left-0 right-0 safe-top">
            <div className="flex items-center justify-between px-4 lg:px-8 py-4">
              <IconTile
                icon={<ArrowLeft />}
                variant="glass"
                label={t('Torna indietro')}
                onClick={() => navigate('/')}
              />
              <div className="flex items-center gap-2">
                <LanguageSwitcher languages={museum?.activeLanguages} variant="glass" />
                <IconTile
                  icon={<UserCircle />}
                  variant="glass"
                  label={t('Account')}
                  onClick={() => navigate('/account')}
                />
                {config?.branding.logo && (
                  <img
                    src={config.branding.logo}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-white/20"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
            <div className="lg:max-w-6xl lg:mx-auto">
              <h1 className="font-display text-3xl lg:text-5xl font-bold text-surface-50 mb-1.5 max-w-2xl">
                {museumName}
              </h1>
              <p className="text-surface-400 text-sm lg:text-base">
                {museum?.location?.address}
                {museum?.location?.address && museum?.location?.city ? ', ' : ''}
                {museum?.location?.city}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="lg:max-w-6xl lg:mx-auto">
        <main className="px-5 py-6 lg:px-8 lg:py-8">
          {/* ── Blocco: info pratiche ────────────────────────────── */}
          {practicalInfo.length > 0 && (
            <section className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {practicalInfo.map(({ icon: Icon, label, value }) => (
                <Card key={label} className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/12 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-[18px] h-[18px] text-brand-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[0.68rem] font-bold uppercase tracking-wide text-surface-500 mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm text-surface-200 line-clamp-2">{value}</p>
                  </div>
                </Card>
              ))}
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
                      {owned ? (
                        <Badge variant="good" icon={<CheckCircle2 className="w-3 h-3" />}>
                          {t('Posseduta')}
                        </Badge>
                      ) : visit.metadata?.isFree ? (
                        <Badge variant="good">{t('Gratis')}</Badge>
                      ) : (
                        <Badge variant="neutral">€{visit.metadata?.price?.toFixed(2)}</Badge>
                      )}
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
    </div>
  );
}
