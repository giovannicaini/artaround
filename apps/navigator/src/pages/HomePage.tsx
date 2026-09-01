import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, ChevronRight, Compass, ExternalLink, Sparkles, Play } from 'lucide-react';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import { interestAffinity } from '../lib/personalization';
import { loadVisitProgress, type VisitProgress } from '../lib/visitProgress';
import { LoadingState, ErrorState, EmptyState, PressableCard, Badge } from '../components/ui';
import type { Museum, Visit } from '@artaround/shared';

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  // Letto una sola volta all'avvio della schermata: uno stato locale con
  // inizializzatore lazy evita un giro extra di render rispetto a un
  // useEffect che chiama setState in modo sincrono.
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

  const interests = user?.preferences?.interests;
  const { data: allVisits } = useQuery({
    queryKey: ['visits', 'all-for-recommendations'],
    queryFn: () => api.getVisits(),
    enabled: !!interests?.length,
  });

  const recommended = useMemo(() => {
    if (!allVisits || !interests?.length) return [];
    return allVisits
      .map((visit) => ({
        visit,
        score: interestAffinity(interests, visit.targetAudience?.interests),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.visit);
  }, [allVisits, interests]);

  function handleSelectMuseum(museum: Museum) {
    navigate(`/museum/${museum._id}`);
  }

  function handleResumeVisit() {
    if (progress) navigate(`/visit/${progress.visitId}`);
  }

  function handleSelectVisit(visit: Visit) {
    navigate(`/visit/${visit._id}`);
  }

  return (
    <div className="h-full overflow-y-auto scroll-smooth bg-surface-950">
      <div className="lg:max-w-6xl lg:mx-auto lg:px-8 lg:py-10">
        {/* Header */}
        <header className="safe-top px-5 pt-6 pb-2 lg:px-0 lg:pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-brand-500/12 border border-brand-500/25 flex items-center justify-center">
                <Compass className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold text-surface-50 leading-none">
                  ArtAround
                </h1>
                <p className="text-surface-500 text-xs mt-1">Navigator</p>
              </div>
            </div>

            <a
              href="/marketplace"
              className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-300 hover:text-brand-200 bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/20 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Marketplace
            </a>
          </div>
        </header>

        <main className="px-5 py-6 lg:px-0">
          {/* Riprendi visita */}
          {progress && (
            <button
              onClick={handleResumeVisit}
              className="w-full text-left mb-7 rounded-2xl overflow-hidden relative group animate-fade-in"
            >
              <div className="relative h-28 bg-surface-900 border border-surface-800">
                {progress.coverImage && (
                  <img
                    src={progress.coverImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-surface-950 via-surface-950/70 to-transparent" />
                <div className="relative h-full flex items-center justify-between px-5">
                  <div className="min-w-0">
                    <p className="text-brand-300 text-xs font-semibold uppercase tracking-wide mb-1">
                      Riprendi da dove eri
                    </p>
                    <p className="text-surface-50 font-display font-semibold truncate max-w-xs">
                      {progress.visitTitle}
                    </p>
                    <p className="text-surface-400 text-xs mt-0.5">
                      Opera {progress.stepIndex + 1} di {progress.stepsTotal} ·{' '}
                      {progress.artworkTitle}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 ml-3">
                    <Play className="w-4 h-4 text-surface-950 ml-0.5" fill="currentColor" />
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Per te */}
          {recommended.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <h2 className="font-display text-base font-semibold text-surface-50">Per te</h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-3">
                {recommended.map((visit) => (
                  <PressableCard
                    key={visit._id}
                    onClick={() => handleSelectVisit(visit)}
                    className="flex-shrink-0 w-64 lg:w-auto p-4"
                  >
                    <p className="text-surface-50 font-medium truncate mb-1">{visit.title}</p>
                    <p className="text-surface-500 text-xs line-clamp-2">{visit.description}</p>
                  </PressableCard>
                ))}
              </div>
            </section>
          )}

          {/* Title */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-display text-xl lg:text-2xl font-semibold text-surface-50 mb-1">
                Scegli un museo
              </h2>
              <p className="text-sm text-surface-500">Seleziona dove vuoi iniziare la visita</p>
            </div>
          </div>

          {isLoading ? (
            <LoadingState fullHeight={false} message="Cerco i musei disponibili..." />
          ) : isError ? (
            <ErrorState
              message={error instanceof Error ? error.message : 'Impossibile caricare i musei.'}
              onRetry={() => refetch()}
            />
          ) : !museums || museums.length === 0 ? (
            <EmptyState
              icon={<Compass />}
              title="Nessun museo disponibile"
              message="Non ci sono musei disponibili al momento. Riprova più tardi."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {museums.map((museum, index) => (
                <PressableCard
                  key={museum._id}
                  onClick={() => handleSelectMuseum(museum)}
                  className="overflow-hidden animate-slide-up p-0"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="relative h-40 lg:h-44 bg-surface-800 overflow-hidden">
                    {museum.images?.[0] ? (
                      <img
                        src={museum.images[0]}
                        alt={museum.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-900/40 to-surface-900">
                        <Compass className="w-14 h-14 text-brand-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-display font-semibold text-white text-lg leading-tight drop-shadow">
                        {museum.name}
                      </h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-surface-400 line-clamp-2 mb-4 min-h-[2.5rem]">
                      {museum.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-surface-500">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{museum.location?.city}</span>
                      </div>
                      <div className="flex items-center gap-1 text-brand-400 font-semibold text-sm">
                        <span>Esplora</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </PressableCard>
              ))}
            </div>
          )}

          <div className="h-8 safe-bottom lg:hidden" />

          <div className="hidden lg:flex items-center justify-between text-sm text-surface-600 py-8 border-t border-surface-800 mt-8">
            <p>© 2026 ArtAround</p>
            <div className="flex items-center gap-6">
              <a href="/marketplace" className="hover:text-brand-400 transition-colors">
                Marketplace
              </a>
              <Badge variant="brand" icon={<Sparkles className="w-3 h-3" />}>
                Audioguide incluse
              </Badge>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
