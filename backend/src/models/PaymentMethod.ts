import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentMethod extends Document {
  name: string;
  display_order?: number;
  created_at: Date;
  updated_at: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>(
  {
    name: { type: String, required: true },
    display_order: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);
