import mongoose, { Schema, Document } from 'mongoose';

export interface IStoreSettings extends Document {
  business_name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_id?: string;
  default_tax_rate: number;
  receipt_header?: string;
  receipt_footer?: string;
  currency: string;
  logo_url?: string;
  updated_at: Date;
}

const StoreSettingsSchema = new Schema<IStoreSettings>(
  {
    business_name: { type: String, required: true, default: 'Express Distributors Inc' },
    address: String,
    city: String,
    state: String,
    zip: String,
    phone: String,
    email: String,
    website: String,
    tax_id: String,
    logo_url: String,
    default_tax_rate: { type: Number, default: 0 },
    receipt_header: String,
    receipt_footer: String,
    currency: { type: String, default: 'USD' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' } }
);

export default mongoose.model<IStoreSettings>('StoreSettings', StoreSettingsSchema);
