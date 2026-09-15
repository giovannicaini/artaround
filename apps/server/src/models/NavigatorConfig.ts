/*
 * File: /src/models/NavigatorConfig.ts                                                  *
 * Project: @artaround/server                                                            *
 * Last Modified: 11/09/2026                                                             *
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
 * Schema Mongoose della configurazione di branding/PWA del Navigator per museo.
 */
import mongoose, { Schema, Document } from 'mongoose';
import { NavigatorConfig as INavigatorConfig, NAVIGATOR_FONT_OPTIONS } from '@artaround/shared';

const NAVIGATOR_FONT_IDS = NAVIGATOR_FONT_OPTIONS.map((f) => f.id);

export interface NavigatorConfigDocument extends Omit<INavigatorConfig, '_id'>, Document {}

const navigatorConfigSchema = new Schema<NavigatorConfigDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    applicability: { type: String, enum: ['global', 'museum'], required: true },
    // Richiesto solo quando applicability === 'museum' (validato nel controller,
    // non enum-derivabile qui in modo pulito con Mongoose).
    museumId: { type: String, index: true },
    branding: {
      logo: String,
      splashImage: String,
      primaryColor: { type: String, required: true },
      secondaryColor: String,
      backgroundColor: String,
      displayFont: { type: String, enum: NAVIGATOR_FONT_IDS },
      bodyFont: { type: String, enum: NAVIGATOR_FONT_IDS },
    },
    content: {
      homeTitle: String,
      homeTitleTranslations: { type: Map, of: String, default: undefined },
      welcomeText: String,
      welcomeTextTranslations: { type: Map, of: String, default: undefined },
      openingImage: String,
      featuredMuseumId: String,
    },
    pwa: {
      manifestName: { type: String, required: true },
      shortName: { type: String, required: true },
      description: String,
      descriptionTranslations: { type: Map, of: String, default: undefined },
      themeColor: { type: String, required: true },
      backgroundColor: { type: String, required: true },
      display: {
        type: String,
        enum: ['standalone', 'fullscreen', 'minimal-ui', 'browser'],
        default: 'standalone',
      },
      orientation: {
        type: String,
        enum: ['any', 'natural', 'landscape', 'portrait'],
        default: 'portrait',
      },
      startUrl: { type: String, default: '/' },
      scope: { type: String, default: '/' },
      icon192: String,
      icon512: String,
      iconMaskable: String,
      appleTouchIcon: String,
    },
  },
  { timestamps: true },
);

export const NavigatorConfigModel = mongoose.model<NavigatorConfigDocument>(
  'NavigatorConfig',
  navigatorConfigSchema,
);
