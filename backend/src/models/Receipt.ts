import mongoose, { Schema, Document } from 'mongoose';

export interface IReceipt extends Document {
  trx_id: string;
  trx_date: Date;
  customer_id?: mongoose.Types.ObjectId;
  customer_name: string;
  bank_account_id?: mongoose.Types.ObjectId;
  state?: string;
  city?: string;
  so_id?: string;
  invoice_num?: string;
  so_balance?: number;
  pmt_mode: string;
  amount_received: number;
  created_at: Date;
  updated_at: Date;
}

const ReceiptSchema = new Schema<IReceipt>(
  {
    trx_id: { type: String, required: true, unique: true },
    trx_date: { type: Date, required: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
    customer_name: { type: String, required: true },
    bank_account_id: { type: Schema.Types.ObjectId, ref: 'BankAccount' },
    state: String,
    city: String,
    so_id: String,
    invoice_num: String,
    so_balance: Number,
    pmt_mode: { type: String, required: true },
    amount_received: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

ReceiptSchema.index({ trx_date: -1 });
ReceiptSchema.index({ customer_id: 1 });

export default mongoose.model<IReceipt>('Receipt', ReceiptSchema);
