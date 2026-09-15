/*
 * File: /src/services/upload.service.ts                                                 *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 11/02/2026                                                             *
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

import { apiService, type ApiResponse } from './api.service';
import type { ImageProcessOptions, UploadResult, UploadCategory } from '@artaround/shared';
import { __ } from './i18n.service';

/**
 * Upload di file (immagini, SVG) al server.
 */
export class UploadService {
  async uploadFile(
    file: File,
    category: UploadCategory,
    options: ImageProcessOptions = {},
    oldPath?: string,
  ): Promise<ApiResponse<UploadResult>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    if (options.width) formData.append('width', options.width.toString());
    if (options.height) formData.append('height', options.height.toString());
    if (options.fit) formData.append('fit', options.fit);
    if (options.quality) formData.append('quality', options.quality.toString());
    if (options.format) formData.append('format', options.format);
    if (options.cropX !== undefined) formData.append('cropX', options.cropX.toString());
    if (options.cropY !== undefined) formData.append('cropY', options.cropY.toString());
    if (options.cropWidth !== undefined) formData.append('cropWidth', options.cropWidth.toString());
    if (options.cropHeight !== undefined)
      formData.append('cropHeight', options.cropHeight.toString());
    if (oldPath) formData.append('oldPath', oldPath);

    try {
      const token = localStorage.getItem('authToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // NON impostare Content-Type - il browser lo imposta con boundary per multipart

      const response = await fetch('/api/uploads', {
        method: 'POST',
        headers,
        body: formData,
      });

      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: __('Errore durante il caricamento'),
        },
      };
    }
  }

  async uploadFromUrl(
    url: string,
    category: UploadCategory,
    options: ImageProcessOptions = {},
    oldPath?: string,
  ): Promise<ApiResponse<UploadResult>> {
    return apiService.post<UploadResult>('/uploads/from-url', {
      url,
      category,
      ...options,
      oldPath,
    });
  }

  async deleteImage(path: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiService.deleteWithBody<{ deleted: boolean }>('/uploads', { path });
  }

  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }

    return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  }

  getResponsiveImageAttrs(
    imagePath: string,
    options?: { widths?: number[]; sizes?: string },
  ): { src: string; srcset?: string; sizes?: string } {
    const src = this.getImageUrl(imagePath);

    if (!imagePath.startsWith('/uploads/')) {
      return { src };
    }

    const widths = options?.widths ?? [480, 768, 1200];
    const sizes = options?.sizes ?? '100vw';

    const dotIndex = imagePath.lastIndexOf('.');
    if (dotIndex <= 0) {
      return { src };
    }

    const base = imagePath.slice(0, dotIndex);
    const ext = imagePath.slice(dotIndex);

    const srcset = widths
      .map((width) => `${this.getImageUrl(`${base}__w${width}${ext}`)} ${width}w`)
      .join(', ');

    return { src, srcset, sizes };
  }
}

export const uploadService = new UploadService();
