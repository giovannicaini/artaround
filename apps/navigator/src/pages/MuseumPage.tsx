import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Users,
  Star,
  Play,
  ShoppingBag,
  Home,
  Filter,
  AlertCircle,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useNavigator } from '../context/NavigatorContext';
import { CompetenceLevel, type Visit } from '@artaround/shared';

export default function MuseumPage() {
  const navigate = useNavigate();
  const { museumId } = useParams();
  const { currentMuseum, setVisit } = useNavigator();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<CompetenceLevel | null>(null);

  const loadVisits = useCallback(async () => {
    if (!museumId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getVisits(museumId);
      setVisits(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Impossibile caricare le visite. Verifica la connessione.';
      setError(message);
      console.error('Failed to load visits:', err);
    } finally {
      setLoading(false);
    }
  }, [museumId]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  function handleSelectVisit(visit: Visit) {
    setVisit(visit);
    navigate(`/visit/${visit._id}`);
  }

  function getLevelIcon(level: CompetenceLevel) {
    switch (level) {
      case CompetenceLevel.INFANTILE:
        return '👶';
      case CompetenceLevel.SEMPLICE:
        return '🌱';
      case CompetenceLevel.MEDIO:
        return '🌿';
      case CompetenceLevel.AVANZATO:
        return '🌳';
      default:
        return '📚';
    }
  }

  function getLevelLabel(level: CompetenceLevel) {
    switch (level) {
      case CompetenceLevel.INFANTILE:
        return 'Bambini';
      case CompetenceLevel.SEMPLICE:
        return 'Base';
      case CompetenceLevel.MEDIO:
        return 'Intermedio';
      case CompetenceLevel.AVANZATO:
        return 'Avanzato';
      default:
        return level;
    }
  }

  function getLevelColor(level: CompetenceLevel) {
    switch (level) {
      case CompetenceLevel.INFANTILE:
        return 'bg-pink-50 text-pink-700 border-pink-200';
      case CompetenceLevel.SEMPLICE:
        return 'bg-green-50 text-green-700 border-green-200';
      case CompetenceLevel.MEDIO:
        return 'bg-brand-50 text-brand-700 border-brand-200';
      case CompetenceLevel.AVANZATO:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-surface-50 text-surface-700 border-surface-200';
    }
  }

  const filteredVisits = filterLevel
    ? visits.filter((v) => v.targetAudience?.competenceLevel?.includes(filterLevel))
    : visits;

  return (
    <div className="min-h-full bg-surface-50">
      <div className="lg:max-w-6xl lg:mx-auto">
        {/* Header with museum info */}
        <header className="relative">
          {/* Cover image - smaller on desktop */}
          <div className="h-56 lg:h-72 bg-gradient-to-br from-brand-600 to-brand-800 relative overflow-hidden">
            {currentMuseum?.images?.[0] && (
              <img
                src={currentMuseum.images[0]}
                alt={currentMuseum.name}
                className="w-full h-full object-cover opacity-50"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

            {/* Navigation - Desktop has home button too */}
            <div className="absolute top-0 left-0 right-0 safe-top">
              <div className="flex items-center justify-between px-4 lg:px-8 py-4">
                <button
                  onClick={() => navigate('/')}
                  className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
                  aria-label="Torna indietro"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                {/* Desktop: Home button */}
                <button
                  onClick={() => navigate('/')}
                  className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span className="text-sm font-medium">Home</span>
                </button>
              </div>
            </div>

            {/* Museum name */}
            <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
              <div className="lg:max-w-3xl">
                <h1 className="text-2xl lg:text-4xl font-bold text-white mb-2 drop-shadow-lg">
                  {currentMuseum?.name || 'Museo'}
                </h1>
                <p className="text-white/80 text-sm lg:text-base">
                  {currentMuseum?.location?.address}, {currentMuseum?.location?.city}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="bg-surface-50 rounded-t-3xl lg:rounded-none -mt-6 relative z-10">
          <div className="px-5 py-6 lg:px-8 lg:py-8">
            {/* Title and filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-semibold text-surface-900 mb-1">
                  Visite disponibili
                </h2>
                <p className="text-sm text-surface-500">
                  {filteredVisits.length}{' '}
                  {filteredVisits.length === 1 ? 'percorso disponibile' : 'percorsi disponibili'}
                </p>
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <Filter className="w-4 h-4 text-surface-400 flex-shrink-0" />
                {Object.values(CompetenceLevel).map((level) => (
                  <button
                    key={level}
                    onClick={() => setFilterLevel(filterLevel === level ? null : level)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                      filterLevel === level
                        ? getLevelColor(level)
                        : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
                    }`}
                  >
                    {getLevelIcon(level)} {getLevelLabel(level)}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse bg-surface-200 rounded-2xl h-44"></div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">
                  Errore di connessione
                </h3>
                <p className="text-surface-500 mb-4 max-w-md">{error}</p>
                <button
                  onClick={loadVisits}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Riprova
                </button>
              </div>
            ) : visits.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-surface-500">Nessuna visita disponibile per questo museo</p>
                <button
                  onClick={() => navigate('/')}
                  className="mt-2 text-brand-600 font-medium hover:underline"
                >
                  Torna alla home
                </button>
              </div>
            ) : filteredVisits.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-surface-500">Nessuna visita trovata per questo filtro</p>
                <button
                  onClick={() => setFilterLevel(null)}
                  className="mt-2 text-brand-600 font-medium hover:underline"
                >
                  Mostra tutte
                </button>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredVisits.map((visit, index) => (
                  <button
                    key={visit._id}
                    onClick={() => handleSelectVisit(visit)}
                    className="w-full text-left animate-slide-up group"
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="h-full bg-white rounded-2xl p-5 lg:p-6 shadow-sm border border-surface-200 hover:shadow-lg hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-300">
                      {/* Title & Price */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="font-semibold text-surface-900 text-lg lg:text-xl leading-tight">
                          {visit.title}
                        </h3>
                        {visit.metadata?.isFree ? (
                          <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200">
                            Gratis
                          </span>
                        ) : (
                          <span className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold bg-surface-100 text-surface-700">
                            €{visit.metadata?.price?.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Level badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {visit.targetAudience?.competenceLevel?.map((level) => (
                          <span
                            key={level}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getLevelColor(level)}`}
                          >
                            {getLevelIcon(level)} {getLevelLabel(level)}
                          </span>
                        ))}
                      </div>

                      {/* Description */}
                      <p className="text-sm text-surface-600 mb-4 line-clamp-2 min-h-[2.5rem]">
                        {visit.description}
                      </p>

                      {/* Meta info */}
                      <div className="flex items-center justify-between pt-3 border-t border-surface-100">
                        <div className="flex items-center gap-4 text-xs text-surface-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {visit.metadata?.duration} min
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            {visit.metadata?.itemsCount} opere
                          </span>
                          {visit.metadata?.rating && (
                            <span className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                              <span className="font-medium text-surface-700">
                                {visit.metadata.rating}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-brand-600 font-semibold text-sm group-hover:gap-2.5 transition-all">
                          <Play className="w-4 h-4" />
                          <span>Inizia</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Marketplace link */}
            <div className="mt-8 pt-6 border-t border-surface-200">
              <a
                href="/marketplace"
                className="flex items-center justify-center gap-2.5 py-3.5 px-5 bg-white rounded-xl text-surface-600 hover:text-brand-600 hover:bg-brand-50 border border-surface-200 hover:border-brand-200 transition-all"
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="font-medium">Scopri altre visite nel Marketplace</span>
              </a>
            </div>
          </div>

          <div className="h-8 safe-bottom" />
        </main>
      </div>
    </div>
  );
}
