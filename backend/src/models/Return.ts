import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnItem {
  product_id: mongoose.Types.ObjectId;
  product_name: string;
  quantity: number;
  price: number;
  reason: string; // required for audit (e.g. damaged, wrong_item, customer_request)
  subtotal: number;
}

export interface IReturn extends Document {
  return_number: string;
  sale_id?: mongoose.Types.ObjectId; // POS sale
  order_id?: mongoose.Types.ObjectId; // Online order
  customer_id?: mongoose.Types.ObjectId;
  pos_customer_id?: mongoose.Types.ObjectId;
  items: IReturnItem[];
  total_refund: number;
  reason: string; // overall reason (required for audit)
  refund_method: 'original' | 'store_credit' | 'cash' | 'card';
  store_credit_issued?: number;
  status: 'pending' | 'completed' | 'cancelled';
  admin_id?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const ReturnItemSchema = new Schema<IReturnItem>({
  product_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  product_name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  reason: { type: String, required: true },
  subtotal: { type: Number, required: true },
});

const ReturnSchema = new Schema<IReturn>(
  {
    return_number: { type: String, required: true, unique: true },
    sale_id: { type: Schema.Types.ObjectId, ref: 'POSSale' },
    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    customer_id: { type: Schema.Types.ObjectId, ref: 'User' },
    pos_customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
    items: [ReturnItemSchema],
    total_refund: { type: Number, required: true },
    reason: { type: String, required: true },
    refund_method: { type: String, enum: ['original', 'store_credit', 'cash', 'card'], required: true },
    store_credit_issued: Number,
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
    admin_id: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// return_number already has unique: true in schema, no need for duplicate index
ReturnSchema.index({ sale_id: 1 });
ReturnSchema.index({ order_id: 1 });
ReturnSchema.index({ created_at: -1 });

export default mongoose.model<IReturn>('Return', ReturnSchema);
