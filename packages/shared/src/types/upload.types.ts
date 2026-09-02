export type UploadCategory = 'museums' | 'items' | 'artworks' | 'visits' | 'users' | 'misc';

export interface ImageProcessOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number; // 1-100
  format?: 'jpeg' | 'png' | 'webp';
  // Regione di ritaglio (pixel, relativa all'immagine originale)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface UploadResult {
  /** Percorso relativo del file caricato (es. /uploads/museums/abc123.webp) */
  path: string;
  /** Nome file originale */
  originalName: string;
  /** Larghezza finale */
  width: number;
  /** Altezza finale */
  height: number;
  /** Dimensione del file in byte */
  size: number;
  /** Tipo MIME */
  mimeType: string;
}
