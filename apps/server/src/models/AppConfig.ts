import mongoose, { Schema, Document } from 'mongoose';

export interface AppConfigDocument extends Document {
  key: string;
  navigatorDefaultConfigs: unknown[];
  createdAt: Date;
  updatedAt: Date;
}

const navigatorConfigSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    branding: {
      logo: String,
      splashImage: String,
      primaryColor: { type: String, required: true },
      secondaryColor: String,
    },
    content: {
      homeTitle: String,
      homeSubtitle: String,
      welcomeText: String,
      openingImage: String,
    },
    pwa: {
      manifestName: { type: String, required: true },
      shortName: { type: String, required: true },
      description: String,
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
  { _id: false },
);

const appConfigSchema = new Schema<AppConfigDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    navigatorDefaultConfigs: {
      type: [navigatorConfigSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const AppConfigModel = mongoose.model<AppConfigDocument>('AppConfig', appConfigSchema);
