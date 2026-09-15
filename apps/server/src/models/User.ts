/*
 * File: /src/models/User.ts                                                             *
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
 * Schema Mongoose dell'utente: credenziali, ruolo globale, ruoli sui musei, preferenze, credito.
 */
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
