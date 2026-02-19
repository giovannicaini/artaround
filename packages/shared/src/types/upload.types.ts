export type UploadCategory = 'museums' | 'items' | 'artworks' | 'visits' | 'users' | 'misc';

export interface ImageProcessOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number; // 1-100
  format?: 'jpeg' | 'png' | 'webp';
  // Crop region (pixels, relative to original image)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
}

export interface UploadResult {
  /** Relative path to the uploaded file (e.g. /uploads/museums/abc123.webp) */
  path: string;
  /** Original filename */
  originalName: string;
  /** Final width */
  width: number;
  /** Final height */
  height: number;
  /** File size in bytes */
  size: number;
  /** MIME type */
  mimeType: string;
}
