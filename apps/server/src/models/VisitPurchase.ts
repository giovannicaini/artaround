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

visitPurchaseSchema.index({ userId: 1 });
visitPurchaseSchema.index({ visitId: 1 });
visitPurchaseSchema.index({ userId: 1, visitId: 1 }, { unique: true }); // niente acquisti doppi

export const VisitPurchase = mongoose.model<VisitPurchaseDocument>(
  'VisitPurchase',
  visitPurchaseSchema,
);
