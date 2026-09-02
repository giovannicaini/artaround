import { useState, useRef, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Navigation, X } from 'lucide-react';
import type { MuseumMap, MapMarker } from '@artaround/shared';
import { MarkerType } from '@artaround/shared';
import { useT } from '../hooks/useT';
import { format } from '../lib/i18n';
import { polygonCentroid } from '../lib/geometry';
import { buildSmoothPath, computePathArrows } from '../lib/routePath';
import type { RoutePoint } from '../lib/mapRoute';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

interface ArtworkInfo {
  title: string;
  image: string;
}

// Un curatore può segnare un'opera come ARTWORK, SCULPTURE o PAINTING a
// seconda del tipo — sono comunque tutte "un'opera" ai fini della mappa
// (percorso, filtro sul giro, miniatura con immagine). getVisitRoutePoints
// del marketplace le tratta già tutte allo stesso modo cercando solo
// marker.artworkId, senza guardare il type.
function isArtworkMarker(type: MarkerType): boolean {
  return (
    type === MarkerType.ARTWORK || type === MarkerType.SCULPTURE || type === MarkerType.PAINTING
  );
}

interface MapViewProps {
  map: MuseumMap;
  routePoints?: RoutePoint[]; // percorso opere+waypoint, già risolto su tutti i piani
  artworkInfo?: Record<string, ArtworkInfo>; // titolo+immagine per Wikidata ID, per i marker-opera e la conferma di salto
  currentArtworkId?: string; // The artwork currently being viewed (Wikidata ID)
  visitArtworkIds?: string[]; // All artworks in the visit, in order (Wikidata IDs)
  // Marker qualsiasi (ingresso, bar, info point...) a cui una tappa LOGISTIC/
  // NAVIGATION è stata associata dal curatore: apre la mappa già centrata ed
  // evidenziata lì, non solo sulle opere. Ignorato se currentArtworkId trova
  // già un marker (l'opera in ascolto resta la priorità).
  focusMarkerId?: string;
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
  artworkInfo = {},
  currentArtworkId,
  visitArtworkIds = [],
  focusMarkerId,
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
  // Marker-opera cliccato in attesa di conferma prima di saltare a
  // quell'opera nella guida — mai un salto diretto senza chiedere.
  const [pendingMarker, setPendingMarker] = useState<MapMarker | null>(null);
  // Marker di servizio (bagni, ascensori...) cliccato: niente etichetta
  // sempre visibile sulla mappa, la descrizione si apre solo al click.
  const [infoMarker, setInfoMarker] = useState<MapMarker | null>(null);

  const floors = map.floors || [];

  // Il piano di apertura è quello dell'opera che si stava guardando; se non
  // c'è (tappa LOGISTIC/NAVIGATION) ma la tappa è associata a un punto della
  // mappa, quello del punto; altrimenti il primo piano disponibile.
  const [selectedFloorId, setSelectedFloorId] = useState<string>(() => {
    if (currentArtworkId) {
      const floorWithArtwork = floors.find((f) =>
        f.markers?.some((m) => isArtworkMarker(m.type) && m.artworkId === currentArtworkId),
      );
      if (floorWithArtwork) return floorWithArtwork.id;
    }
    if (focusMarkerId) {
      const floorWithMarker = floors.find((f) => f.markers?.some((m) => m.id === focusMarkerId));
      if (floorWithMarker) return floorWithMarker.id;
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

  // Centra sull'opera in ascolto, o sul punto associato alla tappa
  // LOGISTIC/NAVIGATION corrente quando non c'è un'opera.
  useEffect(() => {
    if (!containerRef.current) return;
    const targetMarker = currentArtworkId
      ? floorMarkers.find((m) => isArtworkMarker(m.type) && m.artworkId === currentArtworkId)
      : focusMarkerId
        ? floorMarkers.find((m) => m.id === focusMarkerId)
        : undefined;
    if (targetMarker) {
      const container = containerRef.current;
      const centerX = container.clientWidth / 2 - targetMarker.x * scale;
      const centerY = container.clientHeight / 2 - targetMarker.y * scale;
      setPosition({ x: centerX, y: centerY });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentArtworkId, focusMarkerId, selectedFloorId]);

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

  // Percorso "a cammino" sul piano corrente: una curva morbida (niente
  // spigoli sulle svolte) che passa anche per i waypoint — le svolte mute
  // intorno ai muri — ma solo le opere ricevono un marker cliccabile, un
  // waypoint non è mai una tappa per il visitatore.
  const visitPath = useMemo(
    () => (floorRoutePoints.length >= 2 ? buildSmoothPath(floorRoutePoints) : null),
    [floorRoutePoints],
  );
  const pathArrows = useMemo(
    () => (floorRoutePoints.length >= 2 ? computePathArrows(floorRoutePoints, 90) : []),
    [floorRoutePoints],
  );

  // La mappa riguarda solo le opere davvero in questa visita: un museo può
  // avere molte più opere segnate di quelle incluse in un singolo percorso.
  const visibleMarkers = floorMarkers.filter((marker) => {
    if (marker.type === MarkerType.WAYPOINT) return false;
    if (isArtworkMarker(marker.type)) {
      return !!marker.artworkId && visitArtworkIds.includes(marker.artworkId);
    }
    return true;
  });

  const currentVisitIndex = currentArtworkId ? visitArtworkIds.indexOf(currentArtworkId) : -1;

  // Get unique marker types for legend
  const legendItems = [
    ...new Set(visibleMarkers.filter((m) => !isArtworkMarker(m.type)).map((m) => m.type)),
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
                    className="text-[11px] font-bold fill-surface-950"
                    style={{
                      paintOrder: 'stroke',
                      stroke: 'rgb(255 255 255 / 0.9)',
                      strokeWidth: 3.5,
                    }}
                  >
                    {room.title}
                  </text>
                </g>
              );
            })}

            {/* Percorso della visita, un "cammino" largo che piega dolcemente
                sui waypoint, con frecce che indicano il verso di percorrenza. */}
            {visitPath && (
              <>
                <path
                  d={visitPath}
                  fill="none"
                  stroke="rgb(139 63 252 / 0.2)"
                  strokeWidth={26}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={visitPath}
                  fill="none"
                  stroke="rgb(236 72 153 / 0.42)"
                  strokeWidth={15}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pathArrows.map((arrow, i) => (
                  <polygon
                    key={i}
                    points="-5,-4.5 5.5,0 -5,4.5"
                    fill="white"
                    fillOpacity={0.9}
                    stroke="rgb(139 63 252 / 0.5)"
                    strokeWidth={0.75}
                    transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angleDeg})`}
                  />
                ))}
              </>
            )}

            {/* Marker: solo le opere effettivamente incluse nel percorso di
                questa visita (un museo può averne segnate molte di più) sono
                mostrate con la loro immagine reale, mai un'icona generica. I
                marker di servizio (bagni, bar, uscite...) restano com'erano. */}
            {visibleMarkers.map((marker) => {
              if (isArtworkMarker(marker.type)) {
                const info = marker.artworkId ? artworkInfo[marker.artworkId] : undefined;
                const visitIndex = marker.artworkId
                  ? visitArtworkIds.indexOf(marker.artworkId)
                  : -1;
                const isCurrent = visitIndex >= 0 && visitIndex === currentVisitIndex;
                const isVisited =
                  currentVisitIndex >= 0 && visitIndex >= 0 && visitIndex < currentVisitIndex;
                const radius = isCurrent ? 27 : 20;
                const clipId = `map-thumb-${marker.id}`;

                return (
                  <g
                    key={marker.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => {
                      if (isCurrent) return; // già la tappa in ascolto, niente da confermare
                      setPendingMarker(marker);
                    }}
                  >
                    {/* Anello che pulsa sulla tappa corrente — non è una posizione
                        reale dell'utente (non prevista da specifica), solo
                        l'evidenza di dove ci si è fermati nell'ascolto. */}
                    {isCurrent && (
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={radius + 9}
                        className="animate-ping"
                        fill="rgb(139 63 252 / 0.35)"
                        // Senza transform-box:fill-box lo scale() dell'animazione
                        // parte dall'origine del viewport SVG (0,0) e non dal
                        // centro del cerchio: sembrava un'animazione che ogni
                        // volta "scattava" verso il basso a destra invece di
                        // pulsare simmetricamente sul marker.
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                      />
                    )}

                    {info?.image ? (
                      <>
                        <defs>
                          <clipPath id={clipId}>
                            <circle cx={marker.x} cy={marker.y} r={radius - 2.5} />
                          </clipPath>
                        </defs>
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={radius}
                          className={isCurrent ? 'fill-brand-500' : 'fill-surface-700'}
                        />
                        <image
                          href={info.image}
                          x={marker.x - radius + 2.5}
                          y={marker.y - radius + 2.5}
                          width={(radius - 2.5) * 2}
                          height={(radius - 2.5) * 2}
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#${clipId})`}
                          opacity={isVisited ? 0.55 : 1}
                        />
                        <circle
                          cx={marker.x}
                          cy={marker.y}
                          r={radius}
                          fill="none"
                          className={
                            isCurrent
                              ? 'stroke-brand-300'
                              : isVisited
                                ? 'stroke-surface-500'
                                : 'stroke-white'
                          }
                          strokeWidth={isCurrent ? 3.5 : 2.5}
                        />
                      </>
                    ) : (
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={radius}
                        className={`${isCurrent ? 'fill-brand-500' : 'fill-surface-700'} stroke-white stroke-2`}
                      />
                    )}

                    {/* Distintivo: numero della tappa, o segno di spunta se già
                        ascoltata — sempre leggibile sopra la miniatura. */}
                    <circle
                      cx={marker.x + radius * 0.68}
                      cy={marker.y + radius * 0.68}
                      r={9}
                      className={
                        isCurrent
                          ? 'fill-brand-300'
                          : isVisited
                            ? 'fill-surface-500'
                            : 'fill-ember-500'
                      }
                      stroke="white"
                      strokeWidth={1.5}
                    />
                    <text
                      x={marker.x + radius * 0.68}
                      y={marker.y + radius * 0.68}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="text-[10px] font-bold select-none"
                      fill="white"
                    >
                      {isVisited ? '✓' : visitIndex + 1}
                    </text>
                  </g>
                );
              }

              const config = markerIcons[marker.type];
              const isFocused = !currentArtworkId && marker.id === focusMarkerId;
              return (
                <g
                  key={marker.id}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => setInfoMarker(marker)}
                >
                  {/* Stesso anello pulsante usato per l'opera in ascolto,
                      qui sul punto a cui è associata la tappa LOGISTIC/
                      NAVIGATION corrente (un ingresso, un bar...). */}
                  {isFocused && (
                    <circle
                      cx={marker.x}
                      cy={marker.y}
                      r={25}
                      className="animate-ping"
                      fill="rgb(139 63 252 / 0.35)"
                      style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    />
                  )}
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r={isFocused ? 20 : 16}
                    className={`${isFocused ? 'fill-brand-500 stroke-brand-300' : 'fill-surface-600 stroke-white'} stroke-2`}
                  />
                  <text
                    x={marker.x}
                    y={marker.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-sm select-none"
                    fill="white"
                  >
                    {config.icon}
                  </text>
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
        {((currentArtworkId && floorMarkers.some((m) => m.artworkId === currentArtworkId)) ||
          (!currentArtworkId &&
            focusMarkerId &&
            floorMarkers.some((m) => m.id === focusMarkerId))) && (
          <div className="absolute bottom-4 left-4 gradient-aurora backdrop-blur text-white px-4 py-2 rounded-full shadow-lg">
            <span className="text-sm font-medium">📍 {t('Tappa corrente')}</span>
          </div>
        )}
      </div>

      {/* Conferma prima di saltare a un'altra opera: mai un salto diretto
          al click sul marker. */}
      <Sheet
        open={!!pendingMarker}
        onClose={() => setPendingMarker(null)}
        title={t('Cambiare opera?')}
      >
        {pendingMarker &&
          (() => {
            const info = pendingMarker.artworkId ? artworkInfo[pendingMarker.artworkId] : undefined;
            return (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {info?.image && (
                    <img
                      src={info.image}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    />
                  )}
                  <p className="font-display font-semibold text-surface-50">
                    {info?.title
                      ? format(t('Vuoi passare a "{title}"?'), { title: info.title })
                      : t('Vuoi passare a questa opera?')}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" block onClick={() => setPendingMarker(null)}>
                    {t('Annulla')}
                  </Button>
                  <Button
                    variant="primary"
                    block
                    onClick={() => {
                      onMarkerClick?.(pendingMarker);
                      setPendingMarker(null);
                    }}
                  >
                    {t('Vai')}
                  </Button>
                </div>
              </div>
            );
          })()}
      </Sheet>

      {/* Descrizione di un marker di servizio (bagni, ascensori...): niente
          etichetta sempre visibile sulla mappa, compare solo al click. */}
      <Sheet
        open={!!infoMarker}
        onClose={() => setInfoMarker(null)}
        title={infoMarker ? infoMarker.label || markerIcons[infoMarker.type].label : ''}
      >
        {infoMarker && (
          <p className="text-sm text-surface-300">
            {infoMarker.description || t('Nessuna descrizione disponibile.')}
          </p>
        )}
      </Sheet>
    </div>
  );
}
