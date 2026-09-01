import { useState, useRef, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Navigation, X } from 'lucide-react';
import type { MuseumMap, MapMarker } from '@artaround/shared';
import { MarkerType } from '@artaround/shared';
import { useT } from '../hooks/useT';
import { polygonCentroid } from '../lib/geometry';
import type { RoutePoint } from '../lib/mapRoute';

interface MapViewProps {
  map: MuseumMap;
  routePoints?: RoutePoint[]; // percorso opere+waypoint, già risolto su tutti i piani
  currentArtworkId?: string; // The artwork currently being viewed (Wikidata ID)
  visitArtworkIds?: string[]; // All artworks in the visit, in order (Wikidata IDs)
  onMarkerClick?: (marker: MapMarker) => void;
  onClose?: () => void;
}

// Icon mapping for marker types — funzione (non costante di modulo) perché
// le etichette vanno tradotte con la lingua corrente.
function buildMarkerIcons(
  t: (text: string) => string,
): Record<MarkerType, { icon: string; color: string; label: string }> {
  return {
    [MarkerType.ARTWORK]: { icon: '🖼️', color: 'bg-brand-500', label: t('Opera') },
    [MarkerType.ENTRANCE]: { icon: '🚪', color: 'bg-green-500', label: t('Ingresso') },
    [MarkerType.EXIT]: { icon: '🚶', color: 'bg-blue-500', label: t('Uscita') },
    [MarkerType.TOILETTE]: { icon: '🚻', color: 'bg-cyan-500', label: t('Bagni') },
    [MarkerType.ACCESSIBLE_TOILETTE]: {
      icon: '♿',
      color: 'bg-cyan-600',
      label: t('Bagni accessibili'),
    },
    [MarkerType.BAR]: { icon: '☕', color: 'bg-amber-500', label: t('Bar') },
    [MarkerType.SHOP]: { icon: '🛍️', color: 'bg-pink-500', label: t('Shop') },
    [MarkerType.EMERGENCY_EXIT]: { icon: '🚨', color: 'bg-red-500', label: t('Uscita emergenza') },
    [MarkerType.ELEVATOR]: { icon: '🛗', color: 'bg-purple-500', label: t('Ascensore') },
    [MarkerType.STAIRS]: { icon: '🪜', color: 'bg-orange-500', label: t('Scale') },
    [MarkerType.ACCESSIBILITY]: { icon: '♿', color: 'bg-blue-600', label: t('Accessibilità') },
    [MarkerType.ROOM]: { icon: '🏛️', color: 'bg-surface-500', label: t('Sala') },
    [MarkerType.INFO_POINT]: { icon: 'ℹ️', color: 'bg-blue-400', label: t('Info') },
    [MarkerType.OBSTACLE]: { icon: '⚠️', color: 'bg-yellow-500', label: t('Ostacolo') },
    [MarkerType.BENCH]: { icon: '🪑', color: 'bg-lime-500', label: t('Panchina') },
    [MarkerType.AUDIO_GUIDE]: { icon: '🎧', color: 'bg-indigo-500', label: t('Audioguida') },
    [MarkerType.WIFI]: { icon: '📶', color: 'bg-teal-500', label: 'Wi-Fi' },
    [MarkerType.RESTAURANT]: { icon: '🍽️', color: 'bg-amber-600', label: t('Ristorante') },
    [MarkerType.CLOAKROOM]: { icon: '🧥', color: 'bg-rose-500', label: t('Guardaroba') },
    [MarkerType.LOCKER]: { icon: '🗄️', color: 'bg-fuchsia-500', label: t('Armadio') },
    [MarkerType.SCULPTURE]: { icon: '🗿', color: 'bg-brand-400', label: t('Scultura') },
    [MarkerType.PAINTING]: { icon: '🖌️', color: 'bg-brand-300', label: t('Dipinto') },
    [MarkerType.ESCALATOR]: { icon: '🎢', color: 'bg-orange-600', label: t('Scala mobile') },
    [MarkerType.RAMP]: { icon: '🛤️', color: 'bg-yellow-600', label: t('Rampa') },
    [MarkerType.GALLERY]: { icon: '🖼️', color: 'bg-surface-600', label: t('Galleria') },
    // Non è un punto di interesse: serve solo a far piegare il percorso disegnato sulla
    // mappa, non va mai reso come marker cliccabile per il visitatore.
    [MarkerType.WAYPOINT]: { icon: '', color: 'bg-transparent', label: t('Waypoint') },
  };
}

export default function MapView({
  map,
  routePoints = [],
  currentArtworkId,
  visitArtworkIds = [],
  onMarkerClick,
  onClose,
}: MapViewProps) {
  const t = useT();
  const markerIcons = buildMarkerIcons(t);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(false);

  const floors = map.floors || [];

  // Il piano di apertura è quello dell'opera che si stava guardando, se la
  // mappa ha più di un piano — altrimenti il primo disponibile.
  const [selectedFloorId, setSelectedFloorId] = useState<string>(() => {
    if (currentArtworkId) {
      const floorWithArtwork = floors.find((f) =>
        f.markers?.some((m) => m.type === MarkerType.ARTWORK && m.artworkId === currentArtworkId),
      );
      if (floorWithArtwork) return floorWithArtwork.id;
    }
    return floors[0]?.id || '';
  });

  const currentFloor = floors.find((f) => f.id === selectedFloorId) || floors[0];
  const floorMarkers = currentFloor?.markers || map.markers || [];
  const dimensions = currentFloor?.dimensions || map.dimensions;

  const floorRooms = useMemo(
    () =>
      (map.rooms || []).filter(
        (r) => r.floorId === selectedFloorId && (r.polygon?.length || 0) >= 3,
      ),
    [map.rooms, selectedFloorId],
  );

  const floorRoutePoints = useMemo(
    () => routePoints.filter((p) => p.floorId === selectedFloorId),
    [routePoints, selectedFloorId],
  );

  // Cambiare piano ricentra la vista: dimensioni e contenuto sono diversi.
  function handleSelectFloor(floorId: string) {
    setSelectedFloorId(floorId);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  // Find current artwork marker and center on it
  useEffect(() => {
    if (currentArtworkId && containerRef.current) {
      const currentMarker = floorMarkers.find(
        (m) => m.type === MarkerType.ARTWORK && m.artworkId === currentArtworkId,
      );
      if (currentMarker) {
        const container = containerRef.current;
        const centerX = container.clientWidth / 2 - currentMarker.x * scale;
        const centerY = container.clientHeight / 2 - currentMarker.y * scale;
        setPosition({ x: centerX, y: centerY });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentArtworkId, selectedFloorId]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Linea del percorso sul piano corrente: passa anche per i waypoint (le
  // svolte mute intorno ai muri), ma solo le opere ricevono un marker
  // numerato cliccabile — un waypoint non è mai una tappa per il visitatore.
  const visitPath =
    floorRoutePoints.length >= 2
      ? floorRoutePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
      : null;

  // Get unique marker types for legend
  const legendItems = [
    ...new Set(floorMarkers.filter((m) => m.type !== MarkerType.WAYPOINT).map((m) => m.type)),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-surface-950/[.97] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-800">
        <h2 className="font-display text-base font-semibold text-white">{t('Mappa del Museo')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
            title={t('Legenda')}
          >
            <Navigation size={20} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Floor tabs */}
      {floors.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2.5 border-b border-surface-800 overflow-x-auto">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => handleSelectFloor(floor.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                floor.id === selectedFloorId
                  ? 'gradient-aurora text-white'
                  : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      )}

      {/* Map Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute transition-transform duration-100"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Piano: contenuto SVG reale del piano quando disponibile (caso
              attuale per tutti i musei), altrimenti un'immagine raster legacy. */}
          {currentFloor?.svgContent || map.svgContent ? (
            <div
              style={{ width: dimensions.width, height: dimensions.height }}
              dangerouslySetInnerHTML={{ __html: currentFloor?.svgContent || map.svgContent! }}
            />
          ) : (
            map.imageUrl && (
              <img
                src={map.imageUrl}
                alt=""
                className="max-w-none"
                style={{ width: dimensions.width, height: dimensions.height }}
                draggable={false}
              />
            )
          )}

          {/* SVG Overlay: sale, percorso, marker */}
          <svg
            className="absolute top-0 left-0 pointer-events-none overflow-visible"
            width={dimensions.width}
            height={dimensions.height}
          >
            {/* Sale già contornate — solo un riferimento visivo, mai interattive:
                stessa lezione del marketplace, qui non c'è nulla da editare. */}
            {floorRooms.map((room) => {
              const center = polygonCentroid(room.polygon!);
              return (
                <g key={room.id}>
                  <polygon
                    points={room.polygon!.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="rgb(139 63 252 / 0.08)"
                    stroke="rgb(139 63 252 / 0.3)"
                    strokeWidth={1.5}
                  />
                  <text
                    x={center.x}
                    y={center.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[11px] font-semibold fill-surface-300"
                    style={{ paintOrder: 'stroke', stroke: 'rgb(9 8 19 / 0.7)', strokeWidth: 3 }}
                  >
                    {room.title}
                  </text>
                </g>
              );
            })}

            {/* Percorso della visita, piegato sui waypoint */}
            {visitPath && (
              <path
                d={visitPath}
                fill="none"
                stroke="rgb(236 72 153 / 0.55)"
                strokeWidth={3}
                strokeDasharray="8,4"
                strokeLinecap="round"
              />
            )}

            {/* Marker (i waypoint non sono punti di interesse: servono solo a
                disegnare il percorso, mai mostrati come marker) */}
            {floorMarkers
              .filter((marker) => marker.type !== MarkerType.WAYPOINT)
              .map((marker) => {
                const isCurrentArtwork =
                  marker.type === MarkerType.ARTWORK && marker.artworkId === currentArtworkId;
                const isInVisit =
                  marker.type === MarkerType.ARTWORK &&
                  visitArtworkIds.includes(marker.artworkId || '');
                const visitIndex = marker.artworkId
                  ? visitArtworkIds.indexOf(marker.artworkId)
                  : -1;
                const config = markerIcons[marker.type];

                return (
                  <g
                    key={marker.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => onMarkerClick?.(marker)}
                  >
                    {/* Anello che pulsa sulla tappa corrente — non è una posizione
                        reale dell'utente (non prevista da specifica), solo
                        l'evidenza di dove ci si è fermati nell'ascolto. */}
                    {isCurrentArtwork && (
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r="24"
                        className="animate-ping"
                        fill="rgb(139 63 252 / 0.3)"
                      />
                    )}

                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r={isCurrentArtwork ? 20 : 16}
                      className={`${isCurrentArtwork ? 'fill-brand-500' : isInVisit ? 'fill-brand-700' : 'fill-surface-600'} stroke-white stroke-2`}
                    />

                    <text
                      x={marker.x}
                      y={marker.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-sm select-none"
                      fill="white"
                    >
                      {marker.type === MarkerType.ARTWORK && visitIndex >= 0
                        ? visitIndex + 1
                        : config.icon}
                    </text>

                    {marker.label && marker.type !== MarkerType.ARTWORK && (
                      <text
                        x={marker.x}
                        y={marker.y + 28}
                        textAnchor="middle"
                        className="text-xs fill-white font-medium"
                        style={{
                          paintOrder: 'stroke',
                          stroke: 'rgb(9 8 19 / 0.8)',
                          strokeWidth: 3,
                        }}
                      >
                        {marker.label}
                      </text>
                    )}
                  </g>
                );
              })}
          </svg>
        </div>

        {/* Legend Panel */}
        {showLegend && (
          <div className="absolute top-4 right-4 bg-surface-900/95 backdrop-blur border border-surface-800 rounded-xl p-4 min-w-48 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-3">{t('Legenda')}</h3>
            <div className="space-y-2">
              {legendItems.map((type) => {
                const config = markerIcons[type];
                return (
                  <div key={type} className="flex items-center gap-2 text-sm">
                    <span
                      className={`w-6 h-6 rounded-full ${config.color} flex items-center justify-center text-xs`}
                    >
                      {config.icon}
                    </span>
                    <span className="text-surface-300">{config.label}</span>
                  </div>
                );
              })}
              <div className="pt-2 mt-2 border-t border-surface-700">
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-6 h-6 rounded-full gradient-aurora flex items-center justify-center text-xs text-white font-bold">
                    !
                  </span>
                  <span className="text-surface-300">{t('Tappa corrente')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-3 bg-surface-900/90 backdrop-blur text-white rounded-lg hover:bg-surface-800 transition-colors shadow-lg border border-surface-800"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 bg-surface-900/90 backdrop-blur text-white rounded-lg hover:bg-surface-800 transition-colors shadow-lg border border-surface-800"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={handleReset}
            className="p-3 bg-surface-900/90 backdrop-blur text-white rounded-lg hover:bg-surface-800 transition-colors shadow-lg border border-surface-800"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        {/* Tappa corrente */}
        {currentArtworkId && floorMarkers.some((m) => m.artworkId === currentArtworkId) && (
          <div className="absolute bottom-4 left-4 gradient-aurora backdrop-blur text-white px-4 py-2 rounded-full shadow-lg">
            <span className="text-sm font-medium">📍 {t('Tappa corrente')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
