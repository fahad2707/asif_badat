import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxType extends Document {
  name: string;
  rate_type: 'percent' | 'amount'; // percent = rate is %; amount = rate is fixed USD
  rate: number; // e.g. 8.5 for 8.5%, or 2.50 for $2.50 fixed
  created_at: Date;
  updated_at: Date;
}

const TaxTypeSchema = new Schema<ITaxType>(
  {
    name: { type: String, required: true },
    rate_type: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    rate: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<ITaxType>('TaxType', TaxTypeSchema);
