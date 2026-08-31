import { ArtworkType } from '../types/artwork.types';
import type { SelectOption } from './common';

export const ARTWORK_TYPE_META: Readonly<Record<ArtworkType, { label: string; icon: string }>> = {
  [ArtworkType.Painting]: { label: 'Dipinto', icon: '🖼️' },
  [ArtworkType.Drawing]: { label: 'Disegno', icon: '✏️' },
  [ArtworkType.Sculpture]: { label: 'Scultura', icon: '🗿' },
  [ArtworkType.Print]: { label: 'Stampa', icon: '🖨️' },
  [ArtworkType.Photograph]: { label: 'Fotografia', icon: '📷' },
  [ArtworkType.Installation]: { label: 'Installazione artistica', icon: '🎪' },
  [ArtworkType.NewMedia]: { label: 'Arte digitale', icon: '🎬' },
  [ArtworkType.ManuscriptBook]: { label: 'Manoscritto', icon: '📜' },
  [ArtworkType.DecorativeObject]: { label: 'Arti decorative', icon: '🏺' },
  [ArtworkType.Other]: { label: 'Altro', icon: '🎨' },
} as const;

export const ARTWORK_TYPE_OPTIONS_IT: ReadonlyArray<SelectOption<ArtworkType>> = (
  Object.values(ArtworkType) as ArtworkType[]
).map((type) => ({
  value: type,
  label: `${ARTWORK_TYPE_META[type].icon} ${ARTWORK_TYPE_META[type].label}`,
}));

export function getArtworkTypeLabel(type: ArtworkType | string): string {
  return ARTWORK_TYPE_META[type as ArtworkType]?.label ?? type;
}

export function getArtworkTypeIcon(type: ArtworkType | string): string {
  return ARTWORK_TYPE_META[type as ArtworkType]?.icon ?? '🎨';
}
