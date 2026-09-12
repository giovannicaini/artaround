import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  ChevronRight,
  Compass,
  ExternalLink,
  Sparkles,
  Play,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { useActiveNavigatorConfig } from '../services/useNavigatorTheme';
import { localizedField } from '../services/i18n';
import { loadVisitProgress, type VisitProgress } from '../services/visitProgress';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  PressableCard,
  Badge,
  LanguageSwitcher,
} from '../components/ui';
import type { Museum } from '@artaround/shared';

/** Home come feed di blocchi diversi (vetrina, ripresa visita, righe a scorrimento) invece di un'unica griglia. */
export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const language = useI18nStore((state) => state.language);
  const t = useT();
  const { data: config } = useActiveNavigatorConfig();
  // Inizializzatore lazy: letto una sola volta, senza il giro extra di render di un useEffect.
  const [progress] = useState<VisitProgress | null>(() => loadVisitProgress());

  const {
    data: museums,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['museums'],
    queryFn: () => api.getMuseums(),
  });

  // Museo scelto dall'admin — se non impostato, o non più disponibile, resta il primo della lista.
  const featuredMuseumId = config?.content?.featuredMuseumId;
  const featured =
    (featuredMuseumId && museums?.find((m) => m._id === featuredMuseumId)) || museums?.[0];

  function handleSelectMuseum(museum: Museum) {
    navigate(`/museum/${museum._id}`);
  }

  function handleResumeVisit() {
    if (progress) navigate(`/visit/${progress.visitId}`);
  }

  if (isLoading) {
    return (
      <div className="h-full bg-surface-950">
        <LoadingState message={t('Cerco i musei disponibili...')} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-full bg-surface-950">
        <ErrorState
          message={error instanceof Error ? error.message : t('Impossibile caricare i musei.')}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!museums || museums.length === 0) {
    return (
      <div className="h-full bg-surface-950">
        <EmptyState
          icon={<Compass />}
          title={t('Nessun museo disponibile')}
          message={t('Non ci sono musei disponibili al momento. Riprova più tardi.')}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
      {/* ── Blocco: barra superiore ─────────────────────────────── */}
      <header className="sticky top-0 z-20 safe-top bg-surface-950/85 backdrop-blur-md border-b border-surface-800/60">
        <div className="flex items-center justify-between px-5 lg:px-8 py-3 lg:max-w-6xl lg:mx-auto">
          <div className="flex items-center gap-2.5">
            {config?.branding.logo ? (
              <img src={config.branding.logo} alt="" className="w-8 h-8 rounded-xl object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-xl gradient-aurora flex items-center justify-center">
                <Compass className="w-[18px] h-[18px] text-white" />
              </div>
            )}
            <span className="font-display text-sm font-semibold text-surface-50 tracking-tight">
              {config?.content?.homeTitle
                ? localizedField(
                    language,
                    config.content.homeTitle,
                    config.content.homeTitleTranslations,
                  )
                : 'ArtAround'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/marketplace"
              className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-300 hover:text-brand-200 bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/20 rounded-full transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Marketplace
            </a>
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/account')}
              aria-label={t('Account')}
              title={t('Account')}
              className="w-9 h-9 rounded-full bg-surface-800 border border-surface-700 hover:bg-surface-700 flex items-center justify-center flex-shrink-0 transition-colors"
            >
              {user ? (
                <span className="font-display font-bold text-brand-300 text-xs">
                  {user.username.slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <UserIcon className="w-4 h-4 text-surface-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Blocco: vetrina in evidenza ─────────────────────────── */}
      {featured && (
        <section className="relative">
          <button
            onClick={() => handleSelectMuseum(featured)}
            className="w-full text-left relative h-[68vh] max-h-[560px] min-h-[420px] overflow-hidden group"
          >
            {featured.images?.[0] ? (
              <img
                src={featured.images[0]}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 gradient-aurora opacity-30" />
            )}
            {/* Scrim fisso, non legato al tema: deve scurire una foto reale (o il
                gradiente aurora di riserva) in ogni configurazione. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

            <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10">
              <div className="lg:max-w-6xl lg:mx-auto">
                <Badge variant="brand" icon={<Sparkles className="w-3 h-3" />}>
                  {t('In evidenza')}
                </Badge>
                <h1 className="font-display text-3xl lg:text-5xl font-bold text-white mt-3 mb-2 max-w-xl leading-[1.1]">
                  {localizedField(language, featured.name, featured.nameTranslations)}
                </h1>
                <p className="text-white/70 text-sm lg:text-base max-w-lg mb-5 line-clamp-2">
                  {localizedField(language, featured.description, featured.descriptionTranslations)}
                </p>
                <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full gradient-aurora text-white font-bold text-sm shadow-glow">
                  <Play className="w-4 h-4" fill="currentColor" />
                  {t('Esplora il museo')}
                </div>
              </div>
            </div>
          </button>
        </section>
      )}

      <main className="pb-[calc(2.5rem_+_var(--safe-area-inset-bottom))]">
        {/* ── Blocco: riprendi visita (riga slim) ───────────────── */}
        {progress && (
          <section className="px-5 lg:px-8 lg:max-w-6xl lg:mx-auto -mt-3 relative z-10 mb-8">
            <button
              onClick={handleResumeVisit}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-surface-900/95 backdrop-blur border border-brand-500/30 hover:border-brand-500/60 transition-colors shadow-glow text-left"
            >
              <div className="w-11 h-11 rounded-full gradient-aurora flex items-center justify-center flex-shrink-0">
                <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="gradient-aurora-text text-[0.68rem] font-bold uppercase tracking-wide">
                  {t('Riprendi da dove eri')}
                </p>
                <p className="text-surface-50 font-semibold truncate">{progress.visitTitle}</p>
              </div>
              <span className="text-surface-500 text-xs flex-shrink-0">
                {progress.stepIndex + 1}/{progress.stepsTotal}
              </span>
            </button>
          </section>
        )}

        {/* ── Blocco: riga musei ─────────────────────────────────── */}
        {museums && museums.length > 0 && (
          <FeedRow title={t('Tutti i musei')} icon={<Compass className="w-4 h-4 text-brand-400" />}>
            {museums.map((museum) => (
              <PressableCard
                key={museum._id}
                onClick={() => handleSelectMuseum(museum)}
                className="flex-shrink-0 w-56 lg:w-72 overflow-hidden p-0"
              >
                <div className="relative h-36 bg-surface-800 overflow-hidden">
                  {museum.images?.[0] ? (
                    <img src={museum.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-900/40 to-surface-900">
                      <Compass className="w-10 h-10 text-brand-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
                </div>
                <div className="p-3.5">
                  <h3 className="font-display font-semibold text-surface-50 text-sm leading-tight truncate mb-1.5">
                    {localizedField(language, museum.name, museum.nameTranslations)}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-surface-500 text-xs min-w-0">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{museum.location?.city}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                  </div>
                </div>
              </PressableCard>
            ))}
          </FeedRow>
        )}

        {/* ── Blocco: chiusura ───────────────────────────────────── */}
        <div className="px-5 lg:px-8 lg:max-w-6xl lg:mx-auto mt-4">
          <div className="flex items-center justify-between text-xs text-surface-600 pt-6 border-t border-surface-800">
            <p>© 2026 ArtAround</p>
            <a href="/marketplace" className="hover:text-brand-400 transition-colors lg:hidden">
              Marketplace
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeedRow({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-3 px-5 lg:px-8 lg:max-w-6xl lg:mx-auto">
        {icon}
        <h2 className="font-display text-base font-semibold text-surface-50">{title}</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto scroll-smooth pb-1 px-5 lg:px-8 lg:max-w-6xl lg:mx-auto">
        {children}
      </div>
    </section>
  );
}
