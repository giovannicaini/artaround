/*
 * File: MapView.tsx                                                                     *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 12/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Navigation, X } from 'lucide-react';
import type { MuseumMap, MapMarker } from '@artaround/shared';
import { MarkerType, MARKER_TYPE_META } from '@artaround/shared';
import { useT } from '../services/useT';
import { format } from '../services/i18n';
import { polygonCentroid } from '../services/geometry';
import { buildSmoothPath, computePathArrows } from '../services/routePath';
import type { RoutePoint } from '../services/mapRoute';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

interface ArtworkInfo {
  title: string;
  image: string;
  description?: string; // usata solo fuori da una visita, per la scheda di dettaglio dell'opera
}

// ARTWORK, SCULPTURE E PAINTING devono essere visti come opera, gli altri tipi no
function isArtworkMarker(type: MarkerType): boolean {
  return (
    type === MarkerType.ARTWORK || type === MarkerType.SCULPTURE || type === MarkerType.PAINTING
  );
}

interface MapViewProps {
  map: MuseumMap;
  inVisit?: boolean;
  routePoints?: RoutePoint[]; // percorso opere+waypoint, già risolto su tutti i piani
  artworkInfo?: Record<string, ArtworkInfo>; // titolo+immagine per Wikidata ID
  currentArtworkId?: string; // opera attualmente in ascolto (Wikidata ID)
  visitArtworkIds?: string[]; // tutte le opere della visita, in ordine
  focusMarkerId?: string; //Marker non-opera (ingresso, bar...) associato a una tappa LOGISTIC/NAVIGATION
  onMarkerClick?: (marker: MapMarker) => void;
  onClose?: () => void;
}

// Non è un punto di interesse: serve solo a far piegare il percorso disegnato sulla
// mappa, non va mai reso come marker cliccabile per il visitatore.
const ICON_OVERRIDES: Partial<Record<MarkerType, string>> = {
  [MarkerType.WAYPOINT]: '',
};

function markerIcon(type: MarkerType): string {
  return ICON_OVERRIDES[type] ?? MARKER_TYPE_META[type].icon;
}

// Icon mapping for marker types — funzione (non costante di modulo) perché
// le etichette vanno tradotte con la lingua corrente.
function buildMarkerIcons(
  t: (text: string) => string,
): Record<MarkerType, { icon: string; color: string; label: string }> {
  return {
    [MarkerType.ARTWORK]: {
      icon: markerIcon(MarkerType.ARTWORK),
      color: 'bg-brand-500',
      label: t('Opera'),
    },
    [MarkerType.ENTRANCE]: {
      icon: markerIcon(MarkerType.ENTRANCE),
      color: 'bg-green-500',
      label: t('Ingresso'),
    },
    [MarkerType.EXIT]: {
      icon: markerIcon(MarkerType.EXIT),
      color: 'bg-blue-500',
      label: t('Uscita'),
    },
    [MarkerType.TOILETTE]: {
      icon: markerIcon(MarkerType.TOILETTE),
      color: 'bg-cyan-500',
      label: t('Bagni'),
    },
    [MarkerType.ACCESSIBLE_TOILETTE]: {
      icon: markerIcon(MarkerType.ACCESSIBLE_TOILETTE),
      color: 'bg-cyan-600',
      label: t('Bagni accessibili'),
    },
    [MarkerType.BAR]: { icon: markerIcon(MarkerType.BAR), color: 'bg-amber-500', label: t('Bar') },
    [MarkerType.SHOP]: {
      icon: markerIcon(MarkerType.SHOP),
      color: 'bg-pink-500',
      label: t('Shop'),
    },
    [MarkerType.EMERGENCY_EXIT]: {
      icon: markerIcon(MarkerType.EMERGENCY_EXIT),
      color: 'bg-red-500',
      label: t('Uscita emergenza'),
    },
    [MarkerType.ELEVATOR]: {
      icon: markerIcon(MarkerType.ELEVATOR),
      color: 'bg-purple-500',
      label: t('Ascensore'),
    },
    [MarkerType.STAIRS]: {
      icon: markerIcon(MarkerType.STAIRS),
      color: 'bg-orange-500',
      label: t('Scale'),
    },
    [MarkerType.ACCESSIBILITY]: {
      icon: markerIcon(MarkerType.ACCESSIBILITY),
      color: 'bg-blue-600',
      label: t('Accessibilità'),
    },
    [MarkerType.ROOM]: {
      icon: markerIcon(MarkerType.ROOM),
      color: 'bg-neutral-500',
      label: t('Sala'),
    },
    [MarkerType.INFO_POINT]: {
      icon: markerIcon(MarkerType.INFO_POINT),
      color: 'bg-blue-400',
      label: t('Info'),
    },
    [MarkerType.OBSTACLE]: {
      icon: markerIcon(MarkerType.OBSTACLE),
      color: 'bg-yellow-500',
      label: t('Ostacolo'),
    },
    [MarkerType.BENCH]: {
      icon: markerIcon(MarkerType.BENCH),
      color: 'bg-lime-500',
      label: t('Panchina'),
    },
    [MarkerType.AUDIO_GUIDE]: {
      icon: markerIcon(MarkerType.AUDIO_GUIDE),
      color: 'bg-indigo-500',
      label: t('Audioguida'),
    },
    [MarkerType.WIFI]: { icon: markerIcon(MarkerType.WIFI), color: 'bg-teal-500', label: 'Wi-Fi' },
    [MarkerType.RESTAURANT]: {
      icon: markerIcon(MarkerType.RESTAURANT),
      color: 'bg-amber-600',
      label: t('Ristorante'),
    },
    [MarkerType.CLOAKROOM]: {
      icon: markerIcon(MarkerType.CLOAKROOM),
      color: 'bg-rose-500',
      label: t('Guardaroba'),
    },
    [MarkerType.LOCKER]: {
      icon: markerIcon(MarkerType.LOCKER),
      color: 'bg-fuchsia-500',
      label: t('Armadio'),
    },
    [MarkerType.SCULPTURE]: {
      icon: markerIcon(MarkerType.SCULPTURE),
      color: 'bg-brand-400',
      label: t('Scultura'),
    },
    [MarkerType.PAINTING]: {
      icon: markerIcon(MarkerType.PAINTING),
      color: 'bg-brand-300',
      label: t('Dipinto'),
    },
    [MarkerType.ESCALATOR]: {
      icon: markerIcon(MarkerType.ESCALATOR),
      color: 'bg-orange-600',
      label: t('Scala mobile'),
    },
    [MarkerType.RAMP]: {
      icon: markerIcon(MarkerType.RAMP),
      color: 'bg-yellow-600',
      label: t('Rampa'),
    },
    [MarkerType.GALLERY]: {
      icon: markerIcon(MarkerType.GALLERY),
      color: 'bg-neutral-600',
      label: t('Galleria'),
    },
    [MarkerType.WAYPOINT]: {
      icon: markerIcon(MarkerType.WAYPOINT),
      color: 'bg-transparent',
      label: t('Waypoint'),
    },
  };
}

export default function MapView({
  map,
  inVisit,
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
  const [isPinching, setIsPinching] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showLegend, setShowLegend] = useState(false);
  // Marker-opera cliccato in attesa di conferma prima di saltare a
  // quell'opera nella guida — mai un salto diretto senza chiedere.
  const [pendingMarker, setPendingMarker] = useState<MapMarker | null>(null);
  // Marker di servizio (bagni, ascensori...) cliccato: niente etichetta
  // sempre visibile sulla mappa, la descrizione si apre solo al click.
  const [infoMarker, setInfoMarker] = useState<MapMarker | null>(null);

  const floors = map.floors || [];

  // Piano di apertura: quello dell'opera in ascolto, poi quello del marker associato, poi il primo.
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

  // Blocca il trascinamento entro i bordi del contenuto, mai sfondo vuoto in vista.
  function clampPosition(pos: { x: number; y: number }, atScale: number) {
    const container = containerRef.current;
    if (!container || !dimensions) return pos;
    const contentWidth = dimensions.width * atScale;
    const contentHeight = dimensions.height * atScale;
    const maxX = Math.max(0, container.clientWidth - contentWidth);
    const minX = Math.min(0, container.clientWidth - contentWidth);
    const maxY = Math.max(0, container.clientHeight - contentHeight);
    const minY = Math.min(0, container.clientHeight - contentHeight);
    return {
      x: Math.min(maxX, Math.max(minX, pos.x)),
      y: Math.min(maxY, Math.max(minY, pos.y)),
    };
  }

  // Centra sull'opera in ascolto, o sul marker della tappa corrente se non c'è un'opera.
  function centerOnCurrentMarker(atScale = scale) {
    if (!containerRef.current) return;
    const targetMarker = currentArtworkId
      ? floorMarkers.find((m) => isArtworkMarker(m.type) && m.artworkId === currentArtworkId)
      : focusMarkerId
        ? floorMarkers.find((m) => m.id === focusMarkerId)
        : undefined;
    if (!targetMarker) return;
    const container = containerRef.current;
    const centerX = container.clientWidth / 2 - targetMarker.x * atScale;
    const centerY = container.clientHeight / 2 - targetMarker.y * atScale;
    setPosition(clampPosition({ x: centerX, y: centerY }, atScale));
  }

  useEffect(() => {
    centerOnCurrentMarker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentArtworkId, focusMarkerId, selectedFloorId]);

  const handleZoomIn = () =>
    setScale((s) => {
      const next = Math.min(s + 0.25, 3);
      setPosition((pos) => clampPosition(pos, next));
      return next;
    });
  const handleZoomOut = () =>
    setScale((s) => {
      const next = Math.max(s - 0.25, 0.5);
      setPosition((pos) => clampPosition(pos, next));
      return next;
    });
  const handleReset = () => {
    setScale(1);
    setPosition(clampPosition({ x: 0, y: 0 }, 1));
  };

  // Trascinamento: stessa logica per mouse e touch, cambia solo da dove si
  // leggono le coordinate.
  function startDrag(clientX: number, clientY: number) {
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  }
  function moveDrag(clientX: number, clientY: number) {
    if (!isDragging) return;
    setPosition(clampPosition({ x: clientX - dragStart.x, y: clientY - dragStart.y }, scale));
  }

  const handleMouseDown = (e: React.MouseEvent) => startDrag(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => moveDrag(e.clientX, e.clientY);
  const handleMouseUp = () => setIsDragging(false);

  // Pizzico a due dita: zooma la mappa (non la pagina, vedi touch-none sul
  // contenitore) restando ancorato al punto medio tra le due dita, così il
  // punto sotto le dita resta fermo mentre lo zoom cambia.
  const pinchStateRef = useRef<{
    distance: number;
    scale: number;
    contentX: number;
    contentY: number;
  } | null>(null);

  function touchDistance(t1: React.Touch, t2: React.Touch) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  // Punto medio tra le due dita, relativo al contenitore della mappa (non alla finestra).
  function touchMidpoint(t1: React.Touch, t2: React.Touch) {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: (t1.clientX + t2.clientX) / 2 - (rect?.left || 0),
      y: (t1.clientY + t2.clientY) / 2 - (rect?.top || 0),
    };
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      setIsDragging(false);
      setIsPinching(true);
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const { x: midX, y: midY } = touchMidpoint(t1, t2);
      pinchStateRef.current = {
        distance: touchDistance(t1, t2),
        scale,
        contentX: (midX - position.x) / scale,
        contentY: (midY - position.y) / scale,
      };
    } else {
      pinchStateRef.current = null;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchStateRef.current) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const { x: midX, y: midY } = touchMidpoint(t1, t2);
      const { distance, scale: startScale, contentX, contentY } = pinchStateRef.current;
      const nextScale = Math.min(3, Math.max(0.5, startScale * (touchDistance(t1, t2) / distance)));
      setScale(nextScale);
      setPosition(
        clampPosition(
          { x: midX - contentX * nextScale, y: midY - contentY * nextScale },
          nextScale,
        ),
      );
    } else if (e.touches.length === 1) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      setIsPinching(false);
      pinchStateRef.current = null;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 0) {
      setIsPinching(false);
      pinchStateRef.current = null;
      setIsDragging(false);
    }
  }

  // Curva morbida sul piano corrente, passa anche per i waypoint (solo le opere hanno un marker).
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
    // Nascosto dal curatore (marker-editor nel Marketplace): default a
    // visibile quando il campo non è impostato.
    if (marker.isVisible === false) return false;
    if (marker.type === MarkerType.WAYPOINT) return false;
    if (isArtworkMarker(marker.type) && inVisit) {
      return !!marker.artworkId && visitArtworkIds.includes(marker.artworkId);
    }
    return true;
  });

  const currentVisitIndex = currentArtworkId ? visitArtworkIds.indexOf(currentArtworkId) : -1;

  // Ottiene i tipi di marker unici per la legenda
  const legendItems = [
    ...new Set(visibleMarkers.filter((m) => !isArtworkMarker(m.type)).map((m) => m.type)),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/[.97] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <h2 className="font-display text-base font-semibold text-white">{t('Mappa del Museo')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            title={t('Legenda')}
          >
            <Navigation size={20} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Floor tabs */}
      {floors.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2.5 border-b border-neutral-800 overflow-x-auto">
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => handleSelectFloor(floor.id)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                floor.id === selectedFloorId
                  ? 'gradient-aurora text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
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
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={`absolute ${isDragging || isPinching ? '' : 'transition-transform duration-100'}`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Piano: contenuto SVG reale del piano */}
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
            {/* Sale già contornate */}
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
                    style={{
                      paintOrder: 'stroke',
                      stroke: 'rgb(255 255 255 / 0.9)',
                      strokeWidth: 3.5,
                    }}
                  >
                    <tspan
                      x={center.x}
                      dy={room.subtitle ? '-0.6em' : 0}
                      className="text-[11px] font-bold fill-neutral-950"
                    >
                      {room.title}
                    </tspan>
                    {room.subtitle && (
                      <tspan x={center.x} dy="1.3em" className="text-[9px] fill-neutral-700">
                        {room.subtitle}
                      </tspan>
                    )}
                  </text>
                </g>
              );
            })}

            {/* Percorso della visita */}
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

            {/* Marker: opere + marker di servizio */}
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
                      // Fuori da una visita non c'è nessuna guida a cui saltare: mostra
                      // solo la scheda di dettaglio dell'opera, come per un marker di servizio.
                      if (!inVisit) {
                        setInfoMarker(marker);
                        return;
                      }
                      if (isCurrent) return; // già la tappa in ascolto, niente da confermare
                      setPendingMarker(marker);
                    }}
                  >
                    {/* Anello che pulsa sulla tappa corrente */}
                    {isCurrent && (
                      <circle
                        cx={marker.x}
                        cy={marker.y}
                        r={radius + 9}
                        className="animate-ping"
                        fill="rgb(139 63 252 / 0.35)"
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
                          className={isCurrent ? 'fill-brand-500' : 'fill-neutral-700'}
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
                          // Stesso punto focale/zoom impostati dal curatore nel
                          // marker-editor del Marketplace (default: centro, nessuno zoom).
                          style={
                            marker.focalPoint || marker.focalZoom
                              ? {
                                  transformBox: 'fill-box',
                                  transformOrigin: 'center',
                                  transform: `scale(${marker.focalZoom ?? 1}) translate(${
                                    (50 - (marker.focalPoint?.x ?? 50)) / (marker.focalZoom ?? 1)
                                  }%, ${
                                    (50 - (marker.focalPoint?.y ?? 50)) / (marker.focalZoom ?? 1)
                                  }%)`,
                                }
                              : undefined
                          }
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
                                ? 'stroke-neutral-500'
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
                        className={`${isCurrent ? 'fill-brand-500' : 'fill-neutral-700'} stroke-white stroke-2`}
                      />
                    )}

                    {/* Distintivo: numero della tappa o spunta se già ascoltata */}
                    {inVisit && (
                      <>
                        <circle
                          cx={marker.x + radius * 0.68}
                          cy={marker.y + radius * 0.68}
                          r={9}
                          className={
                            isCurrent
                              ? 'fill-brand-300'
                              : isVisited
                                ? 'fill-neutral-500'
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
                      </>
                    )}
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
                  {/* Anello pulsante per tappa LOGISTIC/NAVIGATION corrente */}
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
                    className={`${isFocused ? 'fill-brand-500 stroke-brand-300' : 'fill-neutral-600 stroke-white'} stroke-2`}
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

        {/* Modale Legenda */}
        {showLegend && (
          <div className="absolute top-4 right-4 bg-neutral-900/95 backdrop-blur border border-neutral-800 rounded-xl p-4 min-w-48 shadow-2xl">
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
                    <span className="text-neutral-300">{config.label}</span>
                  </div>
                );
              })}
              {inVisit && (
                <div className="pt-2 mt-2 border-t border-neutral-700">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-6 h-6 rounded-full gradient-aurora flex items-center justify-center text-xs text-white font-bold">
                      !
                    </span>
                    <span className="text-neutral-300">{t('Tappa corrente')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Controlli per lo zoom */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="p-3 bg-neutral-900/90 backdrop-blur text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-lg border border-neutral-800"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-3 bg-neutral-900/90 backdrop-blur text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-lg border border-neutral-800"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={handleReset}
            className="p-3 bg-neutral-900/90 backdrop-blur text-white rounded-lg hover:bg-neutral-800 transition-colors shadow-lg border border-neutral-800"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        {/* Tappa corrente: ricentra la mappa sul marker in ascolto */}
        {((currentArtworkId && floorMarkers.some((m) => m.artworkId === currentArtworkId)) ||
          (!currentArtworkId &&
            !inVisit &&
            focusMarkerId &&
            floorMarkers.some((m) => m.id === focusMarkerId))) && (
          <button
            onClick={() => centerOnCurrentMarker()}
            className="absolute bottom-4 left-4 gradient-aurora backdrop-blur text-white px-4 py-2 rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="text-sm font-medium">📍 {t('Tappa corrente')}</span>
          </button>
        )}
      </div>

      {/* Conferma prima di saltare a un'altra opera */}
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
                      style={
                        pendingMarker.focalPoint || pendingMarker.focalZoom
                          ? {
                              transform: `scale(${pendingMarker.focalZoom ?? 1}) translate(${
                                (50 - (pendingMarker.focalPoint?.x ?? 50)) /
                                (pendingMarker.focalZoom ?? 1)
                              }%, ${
                                (50 - (pendingMarker.focalPoint?.y ?? 50)) /
                                (pendingMarker.focalZoom ?? 1)
                              }%)`,
                            }
                          : undefined
                      }
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

      {/* Descrizione di un marker (con modale)*/}
      <Sheet
        open={!!infoMarker}
        onClose={() => setInfoMarker(null)}
        title={
          infoMarker
            ? isArtworkMarker(infoMarker.type)
              ? (infoMarker.artworkId && artworkInfo[infoMarker.artworkId]?.title) ||
                markerIcons[infoMarker.type].label
              : infoMarker.label || markerIcons[infoMarker.type].label
            : ''
        }
      >
        {infoMarker &&
          (() => {
            const artwork = infoMarker.artworkId ? artworkInfo[infoMarker.artworkId] : undefined;
            if (isArtworkMarker(infoMarker.type) && artwork) {
              return (
                <div className="flex flex-col gap-3">
                  {artwork.image && (
                    <img
                      src={artwork.image}
                      alt=""
                      className="w-full h-40 rounded-xl object-cover"
                    />
                  )}
                  <p className="text-sm text-surface-300">
                    {artwork.description || t('Nessuna descrizione disponibile.')}
                  </p>
                </div>
              );
            }
            return (
              <p className="text-sm text-surface-300">
                {infoMarker.description || t('Nessuna descrizione disponibile.')}
              </p>
            );
          })()}
      </Sheet>
    </div>
  );
}
