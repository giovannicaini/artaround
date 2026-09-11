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
      homeSubtitle: String,
      homeSubtitleTranslations: { type: Map, of: String, default: undefined },
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
