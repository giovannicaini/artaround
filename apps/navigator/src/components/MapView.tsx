import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Navigation, X } from 'lucide-react';
import type { MuseumMap, MapMarker } from '@artaround/shared';
import { MarkerType } from '@artaround/shared';

interface MapViewProps {
  map: MuseumMap;
  currentArtworkId?: string; // The artwork currently being viewed (Wikidata ID)
  visitArtworkIds?: string[]; // All artworks in the visit, in order (Wikidata IDs)
  onMarkerClick?: (marker: MapMarker) => void;
  onClose?: () => void;
}

// Icon mapping for marker types
const markerIcons: Record<MarkerType, { icon: string; color: string; label: string }> = {
  [MarkerType.ARTWORK]: { icon: '🖼️', color: 'bg-brand-500', label: 'Opera' },
  [MarkerType.ENTRANCE]: { icon: '🚪', color: 'bg-green-500', label: 'Ingresso' },
  [MarkerType.EXIT]: { icon: '🚶', color: 'bg-blue-500', label: 'Uscita' },
  [MarkerType.TOILETTE]: { icon: '🚻', color: 'bg-cyan-500', label: 'Bagni' },
  [MarkerType.ACCESSIBLE_TOILETTE]: {
    icon: '♿',
    color: 'bg-cyan-600',
    label: 'Bagni accessibili',
  },
  [MarkerType.BAR]: { icon: '☕', color: 'bg-amber-500', label: 'Bar' },
  [MarkerType.SHOP]: { icon: '🛍️', color: 'bg-pink-500', label: 'Shop' },
  [MarkerType.EMERGENCY_EXIT]: { icon: '🚨', color: 'bg-red-500', label: 'Uscita emergenza' },
  [MarkerType.ELEVATOR]: { icon: '🛗', color: 'bg-purple-500', label: 'Ascensore' },
  [MarkerType.STAIRS]: { icon: '🪜', color: 'bg-orange-500', label: 'Scale' },
  [MarkerType.ACCESSIBILITY]: { icon: '♿', color: 'bg-blue-600', label: 'Accessibilità' },
  [MarkerType.ROOM]: { icon: '🏛️', color: 'bg-surface-500', label: 'Sala' },
  [MarkerType.INFO_POINT]: { icon: 'ℹ️', color: 'bg-blue-400', label: 'Info' },
  [MarkerType.OBSTACLE]: { icon: '⚠️', color: 'bg-yellow-500', label: 'Ostacolo' },
  [MarkerType.BENCH]: { icon: '🪑', color: 'bg-lime-500', label: 'Panchina' },
  [MarkerType.AUDIO_GUIDE]: { icon: '🎧', color: 'bg-indigo-500', label: 'Audioguida' },
  [MarkerType.WIFI]: { icon: '📶', color: 'bg-teal-500', label: 'Wi-Fi' },
  [MarkerType.RESTAURANT]: { icon: '🍽️', color: 'bg-amber-600', label: 'Ristorante' },
  [MarkerType.CLOAKROOM]: { icon: '🧥', color: 'bg-rose-500', label: 'Guardaroba' },
  [MarkerType.LOCKER]: { icon: '🗄️', color: 'bg-fuchsia-500', label: 'Armadio' },
  [MarkerType.SCULPTURE]: { icon: '🗿', color: 'bg-brand-400', label: 'Scultura' },
  [MarkerType.PAINTING]: { icon: '🖌️', color: 'bg-brand-300', label: 'Dipinto' },
  [MarkerType.ESCALATOR]: { icon: '🎢', color: 'bg-orange-600', label: 'Scala mobile' },
  [MarkerType.RAMP]: { icon: '🛤️', color: 'bg-yellow-600', label: 'Rampa' },
  [MarkerType.GALLERY]: { icon: '🖼️', color: 'bg-surface-600', label: 'Galleria' },
  // Non è un punto di interesse: serve solo a far piegare il percorso disegnato sulla
  // mappa (vedi getVisitPath), non va mai reso come marker cliccabile per il visitatore.
  [MarkerType.WAYPOINT]: { icon: '', color: 'bg-transparent', label: 'Waypoint' },
};

export default function MapView({
  map,
  currentArtworkId,
  visitArtworkIds = [],
  onMarkerClick,
  onClose,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(false);

  // Find current artwork marker and center on it
  useEffect(() => {
    if (currentArtworkId && map.markers) {
      const currentMarker = map.markers.find(
        (m) => m.type === MarkerType.ARTWORK && m.artworkId === currentArtworkId,
      );
      if (currentMarker && containerRef.current) {
        const container = containerRef.current;
        const centerX = container.clientWidth / 2 - currentMarker.x * scale;
        const centerY = container.clientHeight / 2 - currentMarker.y * scale;
        setPosition({ x: centerX, y: centerY });
      }
    }
  }, [currentArtworkId, map.markers, scale]);

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

  // Get visit path (line connecting artworks in order)
  const getVisitPath = () => {
    if (!visitArtworkIds.length || !map.markers) return null;
    const markers = map.markers;

    const pathPoints: { x: number; y: number }[] = [];
    visitArtworkIds.forEach((artworkId) => {
      const marker = markers.find(
        (m) => m.type === MarkerType.ARTWORK && m.artworkId === artworkId,
      );
      if (marker) {
        pathPoints.push({ x: marker.x, y: marker.y });
      }
    });

    if (pathPoints.length < 2) return null;

    const pathD = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <path
        d={pathD}
        fill="none"
        stroke="rgba(139, 92, 246, 0.5)"
        strokeWidth="3"
        strokeDasharray="8,4"
        strokeLinecap="round"
      />
    );
  };

  // Get unique marker types for legend
  const legendItems = [
    ...new Set(map.markers?.filter((m) => m.type !== MarkerType.WAYPOINT).map((m) => m.type) || []),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-surface-900/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-700">
        <h2 className="text-lg font-semibold text-white">Mappa del Museo</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 text-surface-300 hover:text-white hover:bg-surface-700 rounded-lg transition-colors"
            title="Legenda"
          >
            <Navigation size={20} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-surface-300 hover:text-white hover:bg-surface-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

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
          {/* Map Image */}
          {map.imageUrl && (
            <img
              src={map.imageUrl}
              alt="Mappa museo"
              className="max-w-none"
              style={{
                width: map.dimensions.width,
                height: map.dimensions.height,
              }}
              draggable={false}
            />
          )}

          {/* SVG Overlay for markers and path */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={map.dimensions.width}
            height={map.dimensions.height}
          >
            {/* Visit path */}
            {getVisitPath()}

            {/* Markers (i waypoint non sono punti di interesse: servono solo a
                disegnare il percorso, vedi getVisitPath, mai mostrati come marker) */}
            {map.markers
              ?.filter((marker) => marker.type !== MarkerType.WAYPOINT)
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
                    {/* Pulse animation for current artwork */}
                    {isCurrentArtwork && (
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r="24"
                        className="animate-ping"
                        fill="rgba(139, 92, 246, 0.3)"
                      />
                    )}

                    {/* Marker circle */}
                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r={isCurrentArtwork ? 20 : 16}
                      className={`${isCurrentArtwork ? 'fill-brand-500' : isInVisit ? 'fill-brand-400' : 'fill-surface-600'} stroke-white stroke-2`}
                    />

                    {/* Icon or number */}
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

                    {/* Label on hover (shown for non-artwork markers) */}
                    {marker.label && marker.type !== MarkerType.ARTWORK && (
                      <text
                        x={marker.x}
                        y={marker.y + 28}
                        textAnchor="middle"
                        className="text-xs fill-white font-medium"
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
          <div className="absolute top-4 right-4 bg-surface-800/95 backdrop-blur rounded-lg p-4 min-w-48 shadow-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Legenda</h3>
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
                  <span className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-xs text-white font-bold">
                    !
                  </span>
                  <span className="text-surface-300">Posizione attuale</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-3 bg-surface-800/90 backdrop-blur text-white rounded-lg hover:bg-surface-700 transition-colors shadow-lg"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 bg-surface-800/90 backdrop-blur text-white rounded-lg hover:bg-surface-700 transition-colors shadow-lg"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={handleReset}
            className="p-3 bg-surface-800/90 backdrop-blur text-white rounded-lg hover:bg-surface-700 transition-colors shadow-lg"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        {/* Current position indicator */}
        {currentArtworkId && (
          <div className="absolute bottom-4 left-4 bg-brand-500/90 backdrop-blur text-white px-4 py-2 rounded-lg shadow-lg">
            <span className="text-sm font-medium">📍 Sei qui</span>
          </div>
        )}
      </div>
    </div>
  );
}
