import mongoose, { Schema, Document } from 'mongoose';
import {
  User as IUser,
  UserPreferences,
  MuseumRoleAssignment,
  MuseumRole,
} from '@artaround/shared';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

const userPreferencesSchema = new Schema<UserPreferences>(
  {
    competenceLevel: { type: String, required: true },
    interests: [{ type: String }],
    availableTime: { type: String, required: true },
    age: { type: Number },
    language: { type: String, default: 'it' },
  },
  { _id: false },
);

const museumRoleAssignmentSchema = new Schema<MuseumRoleAssignment>(
  {
    museumId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(MuseumRole),
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    assignedBy: {
      type: String,
    },
  },
  { _id: false },
);

const userSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    museumRoles: {
      type: [museumRoleAssignmentSchema],
      default: [],
    },
    preferences: {
      type: userPreferencesSchema,
      required: false,
    },
    creditBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Indice per le query efficienti sulle assegnazioni di ruolo per museo
userSchema.index({ 'museumRoles.museumId': 1, 'museumRoles.role': 1 });

export const User = mongoose.model<UserDocument>('User', userSchema);
