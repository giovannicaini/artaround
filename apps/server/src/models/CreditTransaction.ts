import mongoose, { Schema, Document } from 'mongoose';
import { CreditTransaction as ICreditTransaction, CreditTransactionType } from '@artaround/shared';

export interface CreditTransactionDocument extends Omit<ICreditTransaction, '_id'>, Document {}

const creditTransactionSchema = new Schema<CreditTransactionDocument>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    type: {
      type: String,
      enum: Object.values(CreditTransactionType),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
    },
    relatedType: {
      type: String,
      enum: ['item', 'visit'],
    },
    relatedId: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  },
);

creditTransactionSchema.index({ userId: 1, createdAt: -1 });

export const CreditTransaction = mongoose.model<CreditTransactionDocument>(
  'CreditTransaction',
  creditTransactionSchema,
);
