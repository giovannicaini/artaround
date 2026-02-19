export interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string;
  author?: string;
  authorId?: string;
  movement?: string;
  movementId?: string;
  style?: string;
  styleId?: string;
  epoch?: string;
  inception?: string;
  year?: string;
  period?: string;
  periodId?: string;
  technique?: string;
  materials?: string[];
  location?: string;
  locationId?: string;
  room?: string;
  floor?: string;
  dimensionHeight?: number;
  dimensionWidth?: number;
  dimensionDepth?: number;
  dimensionUnit?: 'cm' | 'm';
}
