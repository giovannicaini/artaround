import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Users, Star, Play, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import { LanguageLevel, type Visit } from '@artaround/shared';
import {
  IconTile,
  Chip,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
  PressableCard,
} from '../components/ui';

const LEVEL_META: Record<LanguageLevel, { emoji: string; label: string }> = {
  [LanguageLevel.CHILDREN]: { emoji: '👶', label: 'Bambini' },
  [LanguageLevel.ELEMENTARY]: { emoji: '🌱', label: 'Base' },
  [LanguageLevel.MEDIUM]: { emoji: '🌿', label: 'Intermedio' },
  [LanguageLevel.SPECIALIST]: { emoji: '🌳', label: 'Avanzato' },
};

export default function MuseumPage() {
  const navigate = useNavigate();
  const { museumId } = useParams();
  const user = useAuthStore((state) => state.user);
  const [filterLevel, setFilterLevel] = useState<LanguageLevel | null>(null);

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

  function handleSelectVisit(visit: Visit) {
    navigate(`/visit/${visit._id}`);
  }

  const filteredVisits = filterLevel
    ? (visits || []).filter((v) => v.targetAudience?.languageLevels?.includes(filterLevel))
    : visits || [];

  return (
    <div className="min-h-full overflow-y-auto bg-surface-950">
      <div className="lg:max-w-6xl lg:mx-auto">
        {/* Header con copertina museo */}
        <header className="relative">
          <div className="h-52 lg:h-64 bg-surface-900 relative overflow-hidden">
            {museum?.images?.[0] && (
              <img
                src={museum.images[0]}
                alt={museum.name}
                className="w-full h-full object-cover opacity-45"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/40 to-surface-950/30" />

            <div className="absolute top-0 left-0 right-0 safe-top">
              <div className="flex items-center justify-between px-4 lg:px-8 py-4">
                <IconTile
                  icon={<ArrowLeft />}
                  variant="glass"
                  label="Torna indietro"
                  onClick={() => navigate('/')}
                />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
              <div className="lg:max-w-3xl">
                <h1 className="font-display text-2xl lg:text-4xl font-semibold text-surface-50 mb-1.5">
                  {museum?.name || (museumLoading ? '' : 'Museo')}
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

        <main className="px-5 py-6 lg:px-8 lg:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-xl lg:text-2xl font-semibold text-surface-50 mb-1">
                Visite disponibili
              </h2>
              <p className="text-sm text-surface-500">
                {filteredVisits.length}{' '}
                {filteredVisits.length === 1 ? 'percorso disponibile' : 'percorsi disponibili'}
              </p>
            </div>

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

          {isLoading ? (
            <LoadingState fullHeight={false} message="Cerco le visite del museo..." />
          ) : isError ? (
            <ErrorState
              message={error instanceof Error ? error.message : 'Impossibile caricare le visite.'}
              onRetry={() => refetch()}
            />
          ) : !visits || visits.length === 0 ? (
            <EmptyState
              icon={<Play />}
              title="Nessuna visita disponibile"
              message="Questo museo non ha ancora visite pubblicate."
            />
          ) : filteredVisits.length === 0 ? (
            <EmptyState
              icon={<Play />}
              title="Nessuna visita per questo filtro"
              action={
                <button
                  onClick={() => setFilterLevel(null)}
                  className="text-brand-400 text-sm font-medium hover:underline"
                >
                  Mostra tutte
                </button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredVisits.map((visit, index) => {
                const owned = ownedVisitIds.has(visit._id);
                return (
                  <PressableCard
                    key={visit._id}
                    onClick={() => handleSelectVisit(visit)}
                    className="p-5 lg:p-6 animate-slide-up"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-display font-semibold text-surface-50 text-lg leading-tight">
                        {visit.title}
                      </h3>
                      {owned ? (
                        <Badge variant="good" icon={<CheckCircle2 className="w-3 h-3" />}>
                          Posseduta
                        </Badge>
                      ) : visit.metadata?.isFree ? (
                        <Badge variant="good">Gratis</Badge>
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
                      {visit.description}
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-surface-800">
                      <div className="flex items-center gap-4 text-xs text-surface-500">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {visit.metadata?.estimatedDuration} min
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          {visit.metadata?.artworksCount} opere
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

                      <div className="flex items-center gap-1.5 text-brand-400 font-semibold text-sm">
                        <Play className="w-4 h-4" />
                        <span>{owned ? 'Continua' : 'Inizia'}</span>
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
              <span className="font-medium">Scopri altre visite nel Marketplace</span>
            </a>
          </div>
        </main>

        <div className="h-8 safe-bottom" />
      </div>
    </div>
  );
}
