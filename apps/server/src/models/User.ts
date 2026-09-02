import mongoose, { Schema, Document } from 'mongoose';
import {
  User as IUser,
  UserRole,
  UserPreferences,
  RoleAssignment,
  ContextualRole,
  ResourceType,
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

const roleAssignmentSchema = new Schema<RoleAssignment>(
  {
    role: {
      type: String,
      enum: Object.values(ContextualRole),
      required: true,
    },
    resourceType: {
      type: String,
      enum: Object.values(ResourceType),
      required: true,
    },
    resourceId: {
      type: String,
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
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.VISITOR,
    },
    roleAssignments: {
      type: [roleAssignmentSchema],
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

// Index for efficient role assignment queries
userSchema.index({ 'roleAssignments.resourceType': 1, 'roleAssignments.resourceId': 1 });

export const User = mongoose.model<UserDocument>('User', userSchema);
