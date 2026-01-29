import mongoose, { Schema, Document } from 'mongoose';
import { User as IUser, UserRole, UserPreferences } from '@artaround/shared';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

const userPreferencesSchema = new Schema<UserPreferences>({
  competenceLevel: { type: String, required: true },
  interests: [{ type: String }],
  availableTime: { type: String, required: true },
  age: { type: Number },
  language: { type: String, default: 'it' },
}, { _id: false });

const userSchema = new Schema<UserDocument>({
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
  preferences: { 
    type: userPreferencesSchema,
    required: false,
  },
}, {
  timestamps: true,
});

export const User = mongoose.model<UserDocument>('User', userSchema);
