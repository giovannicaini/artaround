import mongoose, { Schema, Document } from 'mongoose';

export interface ItemPurchaseDocument extends Document {
  itemId: string;
  userId: string;
  price: number;
  purchasedAt: Date;
}

const itemPurchaseSchema = new Schema<ItemPurchaseDocument>(
  {
    itemId: {
      type: String,
      required: true,
      ref: 'Item',
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

itemPurchaseSchema.index({ userId: 1 });
itemPurchaseSchema.index({ itemId: 1 });
itemPurchaseSchema.index({ userId: 1, itemId: 1 }, { unique: true });

export const ItemPurchase = mongoose.model<ItemPurchaseDocument>(
  'ItemPurchase',
  itemPurchaseSchema,
);
