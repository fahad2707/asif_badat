'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Package, Truck, MapPin, Clock } from 'lucide-react';

const API = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api');

interface OrderData {
  order_number: string;
  customer_name: string;
  items: { product_name: string; quantity: number; price: number; subtotal: number }[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  status_history: { status: string; timestamp: string }[];
  created_at: string;
}

const STATUS_STEPS = ['confirmed', 'packed', 'dispatched', 'delivered'];

function OrderConfirmationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const orderNum = params.get('order');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderNum) { setLoading(false); return; }
    fetch(`${API}/online-orders/track/${orderNum}`)
      .then((r) => r.json())
      .then((d) => { if (d.order_number) setOrder(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderNum]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  if (!order) return <div className="min-h-screen flex items-center justify-center text-gray-500">Order not found</div>;

  const currentIdx = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isCancelled ? 'bg-red-100' : 'bg-green-100'}`}>
            <CheckCircle className={`w-8 h-8 ${isCancelled ? 'text-red-600' : 'text-green-600'}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isCancelled ? 'Order Cancelled' : 'Thank You for Your Order!'}
          </h1>
          <p className="text-gray-600">
            Order <span className="font-semibold">{order.order_number}</span> •{' '}
            {new Date(order.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Status timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h2 className="font-semibold mb-4">Order Status</h2>
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((s, i) => {
                const done = i <= currentIdx;
                const icons = [Package, Package, Truck, MapPin];
                const Icon = icons[i];
                return (
                  <div key={s} className="flex flex-col items-center flex-1 relative">
                    {i > 0 && (
                      <div className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${i <= currentIdx ? 'bg-[#0f766e]' : 'bg-gray-200'}`} />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${done ? 'bg-[#0f766e] text-white' : 'bg-gray-200 text-gray-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-xs mt-2 capitalize ${done ? 'text-[#0f766e] font-medium' : 'text-gray-400'}`}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
            This order has been cancelled.
          </div>
        )}

        {/* Order items */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="font-semibold mb-4">Items Ordered</h2>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-gray-900">{item.product_name}</p>
                <p className="text-sm text-gray-500">Qty: {item.quantity} × ${item.price.toFixed(2)}</p>
              </div>
              <p className="font-medium">${item.subtotal.toFixed(2)}</p>
            </div>
          ))}
          <div className="border-t mt-3 pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>${(order.tax_amount || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-base mt-2 pt-2 border-t">
              <span>Total</span><span>${(order.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment & delivery info */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Payment</p>
              <p className="font-medium capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Credit Card'}</p>
              <p className={`text-xs mt-1 ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Customer</p>
              <p className="font-medium">{order.customer_name}</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button onClick={() => router.push('/')} className="px-6 py-2.5 bg-[#0f766e] text-white font-medium rounded-lg hover:bg-[#0d5d57]">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}
