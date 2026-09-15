/*
 * File: /src/models/VisitPurchase.ts                                                    *
 * Project: @artaround/server                                                            *
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
 * Schema Mongoose di un acquisto di visita nel marketplace.
 */
import mongoose, { Schema, Document } from 'mongoose';
import { VisitPurchase as IVisitPurchase } from '@artaround/shared';

export interface VisitPurchaseDocument extends Omit<IVisitPurchase, '_id'>, Document {}

const visitPurchaseSchema = new Schema<VisitPurchaseDocument>(
  {
    visitId: {
      type: String,
      required: true,
      ref: 'Visit',
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
);

// Indici
visitPurchaseSchema.index({ userId: 1 });
visitPurchaseSchema.index({ visitId: 1 });
visitPurchaseSchema.index({ userId: 1, visitId: 1 }, { unique: true }); //Unicità prenotazione

export const VisitPurchase = mongoose.model<VisitPurchaseDocument>(
  'VisitPurchase',
  visitPurchaseSchema,
);
