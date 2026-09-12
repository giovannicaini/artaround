import { api } from './apiClient';
import {
  VisitStepType,
  type Item,
  type MuseumMap,
  type Visit,
  type Artwork,
  type AppLanguage,
  type MuseumService,
} from '@artaround/shared';
import type { PlayerStep } from '../context/visitSessionStore';
import { buildVisitRoutePoints, buildMuseumMap, type RoutePoint } from './mapRoute';

export async function loadVisitData(visitId: string): Promise<{
  visit: Visit;
  steps: PlayerStep[];
  museumMap: MuseumMap | null;
  routePoints: RoutePoint[];
  artworkInfo: Record<string, { title: string; image: string }>;
  // Solo le lingue per cui il curatore ha davvero generato le traduzioni.
  activeLanguages: AppLanguage[] | undefined;
  // Solo i servizi che il curatore ha attivato per questo museo.
  activeServices: MuseumService[];
}> {
  const visit = await api.getVisit(visitId);
  if (!visit.steps || visit.steps.length === 0) {
    throw new Error('Questa visita non contiene tappe.');
  }

  let museumMap: MuseumMap | null = null;
  let routePoints: RoutePoint[] = [];
  let activeLanguages: AppLanguage[] | undefined;
  let activeServices: MuseumService[] = [];
  // museumId della visita può essere il QID o l'_id Mongo — gli Item usano sempre il QID.
  let museumWikidataId: string | undefined;
  if (visit.museumId) {
    try {
      const museum = await api.getMuseum(visit.museumId as string);
      activeLanguages = museum.activeLanguages;
      activeServices = (museum.services?.services || []).filter((service) => service.active);
      museumWikidataId = museum.wikidataId;
      museumMap = buildMuseumMap(museum);
      if (museumMap) {
        routePoints = buildVisitRoutePoints(visit.steps, museum.floors || []);
      }
    } catch {
      // Errore nel caricamento della mappa
    }
  }

  // Solo gli item scelti dal curatore, o tutti se non ne ha scelto nessuno esplicitamente.
  const filterByItemIds = (items: Item[], itemIds?: string[]): Item[] =>
    itemIds && itemIds.length > 0 ? items.filter((item) => itemIds.includes(item._id)) : items;

  const orderedSteps = [...visit.steps]
    .filter((step) => step.type !== VisitStepType.WAYPOINT)
    .sort((a, b) => a.order - b.order);

  const artworkStepDefs = orderedSteps.filter(
    (step) => step.type === VisitStepType.ARTWORK && step.artworkId,
  );
  const artworkIds = [...new Set(artworkStepDefs.map((s) => s.artworkId!))];

  const contentStepDefs = orderedSteps.filter(
    (step) => step.type === VisitStepType.CONTENT && step.contentReferenceType,
  );
  const contentReferenceTypes = [...new Set(contentStepDefs.map((s) => s.contentReferenceType!))];

  const artworks = await Promise.all(
    artworkIds.map(async (id) => {
      try {
        return await api.getArtwork(id);
      } catch {
        return null;
      }
    }),
  );
  const artworksById: Record<string, Artwork> = {};
  const artworkInfo: Record<string, { title: string; image: string }> = {};
  artworks.forEach((artwork) => {
    if (artwork) {
      artworksById[artwork.wikidataId] = artwork;
      artworksById[artwork._id] = artwork;
      artworkInfo[artwork.wikidataId] = { title: artwork.title, image: artwork.image };
    }
  });

  const itemsByArtworkId: Record<string, Item[]> = {};
  await Promise.all(
    artworkIds.map(async (id) => {
      try {
        itemsByArtworkId[id] = await api.getItemsForArtwork(id);
      } catch {
        itemsByArtworkId[id] = [];
      }
    }),
  );

  // Item per tappa CONTENT
  const itemsByReferenceType: Record<string, Item[]> = {};
  if (museumWikidataId) {
    await Promise.all(
      contentReferenceTypes.map(async (referenceType) => {
        try {
          itemsByReferenceType[referenceType] = await api.getItemsByReferenceType(
            referenceType,
            museumWikidataId as string,
          );
        } catch {
          itemsByReferenceType[referenceType] = [];
        }
      }),
    );
  }

  // Contenuto su autore/movimento delle opere
  const resolvedArtworks = Object.values(artworksById);
  const authorWikidataIds = [
    ...new Set(resolvedArtworks.map((a) => a.authorWikidataId).filter((id): id is string => !!id)),
  ];
  const movementWikidataIds = [
    ...new Set(
      resolvedArtworks.map((a) => a.movementWikidataId).filter((id): id is string => !!id),
    ),
  ];
  const itemsByAuthorId: Record<string, Item[]> = {};
  const itemsByMovementId: Record<string, Item[]> = {};
  await Promise.all([
    ...authorWikidataIds.map(async (id) => {
      try {
        itemsByAuthorId[id] = await api.getItems({ referenceType: 'author', referenceId: id });
      } catch {
        itemsByAuthorId[id] = [];
      }
    }),
    ...movementWikidataIds.map(async (id) => {
      try {
        itemsByMovementId[id] = await api.getItems({ referenceType: 'movement', referenceId: id });
      } catch {
        itemsByMovementId[id] = [];
      }
    }),
  ]);

  const steps: PlayerStep[] = orderedSteps
    .map((step): PlayerStep | null => {
      if (step.type === VisitStepType.ARTWORK && step.artworkId) {
        const artwork = artworksById[step.artworkId];
        if (!artwork) return null;
        return {
          kind: 'artwork',
          id: step.id,
          artwork,
          items: filterByItemIds(itemsByArtworkId[step.artworkId] || [], step.itemIds),
          authorItems: artwork.authorWikidataId
            ? itemsByAuthorId[artwork.authorWikidataId]
            : undefined,
          movementItems: artwork.movementWikidataId
            ? itemsByMovementId[artwork.movementWikidataId]
            : undefined,
        };
      }
      if (step.type === VisitStepType.CONTENT && step.contentReferenceType) {
        const items = filterByItemIds(
          itemsByReferenceType[step.contentReferenceType] || [],
          step.itemIds,
        );
        if (items.length === 0) return null;
        return {
          kind: 'content',
          id: step.id,
          referenceType: step.contentReferenceType,
          items,
          mapMarkerId: step.mapMarkerId,
        };
      }
      if (step.type === VisitStepType.LOGISTIC) {
        return {
          kind: 'logistic',
          id: step.id,
          title: step.logisticTitle || 'Informazioni utili',
          titleTranslations: step.logisticTitleTranslations,
          text: step.logisticText || '',
          textTranslations: step.logisticTextTranslations,
          textAudio: step.logisticTextAudio,
          icon: step.logisticIcon,
          mapMarkerId: step.mapMarkerId,
        };
      }
      if (step.type === VisitStepType.NAVIGATION) {
        return {
          kind: 'navigation',
          id: step.id,
          text: step.navigationText || '',
          textTranslations: step.navigationTextTranslations,
          textAudio: step.navigationTextAudio,
          image: step.navigationImage,
          visual: step.navigationVisual,
          mapMarkerId: step.mapMarkerId,
        };
      }
      return null;
    })
    .filter((s): s is PlayerStep => s !== null);

  if (steps.length === 0) {
    throw new Error('Impossibile caricare le tappe di questa visita.');
  }

  return { visit, steps, museumMap, routePoints, artworkInfo, activeLanguages, activeServices };
}
