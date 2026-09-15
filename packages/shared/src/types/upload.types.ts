/*
 * File: /src/types/upload.types.ts                                                      *
 * Project: @artaround/shared                                                            *
 * Last Modified: 02/09/2026                                                             *
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

/**
 * Tipi Upload media (immagini)
 * Usati nell'image picker, presente in tutta la ui dove si caricano immagini per editarle online
 */

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
  // /** Percorso relativo del file caricato (es. /uploads/museums/abc123.webp)
  path: string;
  // /** Nome file originale
  originalName: string;
  // /** Larghezza finale
  width: number;
  // /** Altezza finale
  height: number;
  // /** Dimensione del file in byte
  size: number;
  // /** Tipo MIME
  mimeType: string;
}
