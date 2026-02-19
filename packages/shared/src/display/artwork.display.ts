import { ArtworkType } from '../types/artwork.types';
import type { SelectOption } from './common';

export const ARTWORK_TYPE_META: Readonly<Record<ArtworkType, { label: string; icon: string }>> = {
  [ArtworkType.PAINTING]: { label: 'Dipinto', icon: '🖼️' },
  [ArtworkType.SCULPTURE]: { label: 'Scultura', icon: '🗿' },
  [ArtworkType.FRESCO]: { label: 'Affresco', icon: '🏛️' },
  [ArtworkType.MOSAIC]: { label: 'Mosaico', icon: '🔲' },
  [ArtworkType.DRAWING]: { label: 'Disegno', icon: '✏️' },
  [ArtworkType.PRINT]: { label: 'Stampa', icon: '🖨️' },
  [ArtworkType.RELIEF]: { label: 'Bassorilievo', icon: '⬜' },
  [ArtworkType.INSTALLATION]: { label: 'Installazione', icon: '🎪' },
  [ArtworkType.DECORATIVE]: { label: 'Arte Decorativa', icon: '🏺' },
  [ArtworkType.TAPESTRY]: { label: 'Arazzo', icon: '🧵' },
  [ArtworkType.OTHER]: { label: 'Altro', icon: '🎨' },
};

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
