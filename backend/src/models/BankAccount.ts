import mongoose, { Schema, Document } from 'mongoose';

export interface IBankAccount extends Document {
  name: string;
  account_number?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    name: { type: String, required: true },
    account_number: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
