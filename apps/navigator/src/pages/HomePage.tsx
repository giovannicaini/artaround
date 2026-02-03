import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Compass, ExternalLink, Sparkles, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useNavigator } from '../context/NavigatorContext';
import type { Museum } from '@artaround/shared';

export default function HomePage() {
  const navigate = useNavigate();
  const { setMuseum } = useNavigator();
  const [museums, setMuseums] = useState<Museum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMuseums = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getMuseums();
      setMuseums(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Impossibile caricare i musei. Verifica la connessione.';
      setError(message);
      console.error('Failed to load museums:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMuseums();
  }, [loadMuseums]);

  function handleSelectMuseum(museum: Museum) {
    setMuseum(museum);
    navigate(`/museum/${museum._id}`);
  }

  return (
    <div className="min-h-full bg-surface-50">
      {/* Desktop: Centered container with max-width */}
      <div className="lg:max-w-6xl lg:mx-auto lg:px-8 lg:py-8">
        {/* Header - Mobile: gradient, Desktop: clean */}
        <header className="bg-gradient-to-b from-brand-600 to-brand-700 lg:bg-transparent lg:from-transparent lg:to-transparent">
          <div className="safe-top px-5 pt-6 pb-8 lg:px-0 lg:pt-0 lg:pb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-white/20 lg:bg-gradient-to-br lg:from-brand-500 lg:to-brand-700 backdrop-blur-sm flex items-center justify-center shadow-lg lg:shadow-brand-500/30">
                  <Compass className="w-7 h-7 lg:w-8 lg:h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-white lg:text-surface-900">
                    ArtAround
                  </h1>
                  <p className="text-brand-200 lg:text-surface-500 text-sm">Navigator</p>
                </div>
              </div>

              {/* Desktop: Link to marketplace */}
              <a
                href="/marketplace"
                className="hidden lg:flex items-center gap-2 px-4 py-2 text-sm font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Marketplace
              </a>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="bg-surface-50 rounded-t-3xl lg:rounded-none -mt-4 lg:mt-0">
          <div className="px-5 py-6 lg:px-0">
            {/* Title section */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl lg:text-2xl font-semibold text-surface-900 mb-1">
                  Scegli un museo
                </h2>
                <p className="text-sm lg:text-base text-surface-500">
                  Seleziona il museo che vuoi visitare
                </p>
              </div>

              {/* Desktop: Feature badge */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Audioguide incluse</span>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-surface-200 rounded-2xl h-64 lg:h-72"></div>
                  </div>
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
                  onClick={loadMuseums}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Riprova
                </button>
              </div>
            ) : museums.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-surface-100 flex items-center justify-center">
                  <Compass className="w-8 h-8 text-surface-400" />
                </div>
                <h3 className="text-lg font-semibold text-surface-900 mb-2">
                  Nessun museo disponibile
                </h3>
                <p className="text-surface-500 max-w-md">
                  Non ci sono musei disponibili al momento. Riprova più tardi.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {museums.map((museum, index) => (
                  <button
                    key={museum._id}
                    onClick={() => handleSelectMuseum(museum)}
                    className="w-full text-left animate-slide-up group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden hover:shadow-lg hover:border-brand-200 hover:-translate-y-1 transition-all duration-300">
                      {/* Image */}
                      <div className="relative h-40 lg:h-48 bg-surface-200 overflow-hidden">
                        {museum.images?.[0] ? (
                          <img
                            src={museum.images[0]}
                            alt={museum.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
                            <Compass className="w-16 h-16 text-brand-300" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

                        {/* Title overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="font-bold text-white text-lg lg:text-xl leading-tight drop-shadow-lg">
                            {museum.name}
                          </h3>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-4 lg:p-5">
                        <p className="text-sm text-surface-600 line-clamp-2 mb-4 min-h-[2.5rem]">
                          {museum.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-surface-500">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm">{museum.location?.city}</span>
                          </div>
                          <div className="flex items-center gap-1 text-brand-600 font-semibold text-sm group-hover:gap-2 transition-all">
                            <span>Esplora</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile: Bottom spacing */}
          <div className="h-8 safe-bottom lg:hidden" />

          {/* Desktop: Footer info */}
          <div className="hidden lg:block py-8 border-t border-surface-200 mt-8">
            <div className="flex items-center justify-between text-sm text-surface-500">
              <p>© 2026 ArtAround. Tutti i diritti riservati.</p>
              <div className="flex items-center gap-6">
                <a href="/marketplace" className="hover:text-brand-600 transition-colors">
                  Marketplace
                </a>
                <a href="/api-docs" className="hover:text-brand-600 transition-colors">
                  API
                </a>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
