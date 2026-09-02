export type UploadCategory = 'museums' | 'items' | 'artworks' | 'visits' | 'users' | 'misc';

export interface ImageProcessOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number; // 1-100
  format?: 'jpeg' | 'png' | 'webp';
  // ritaglio in pixel, relativo all'immagine originale
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface UploadResult {
  path: string; // es. /uploads/museums/abc123.webp
  originalName: string;
  width: number;
  height: number;
  size: number; // byte
  mimeType: string;
}
