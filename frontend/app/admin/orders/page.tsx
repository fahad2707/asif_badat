'use client';

import { useEffect, useState } from 'react';
import { Package, CheckCircle, Truck, MapPin, X, Search, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface StatusEntry {
  status: string;
  timestamp: string;
}

interface OnlineOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip: string;
  items: OrderItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  status: string;
  status_history: StatusEntry[];
  invoice_id?: string;
  created_at: string;
}

interface Summary {
  confirmed: number;
  packed: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  total: number;
}

const STATUS_FLOW = ['confirmed', 'packed', 'dispatched', 'delivered'] as const;
const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  packed: { label: 'Packed', icon: Package, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  dispatched: { label: 'Dispatched', icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  delivered: { label: 'Delivered', icon: MapPin, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  cancelled: { label: 'Cancelled', icon: X, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

export default function OnlineOrdersPage() {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const [ordersRes, summaryRes] = await Promise.all([
        adminApi.get('/online-orders', { params: filter !== 'all' ? { status: filter } : {} }),
        adminApi.get('/online-orders/summary'),
      ]);
      setOrders(ordersRes.data || []);
      setSummary(summaryRes.data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [filter]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    if (!confirm(`Mark this order as "${newStatus}"?`)) return;
    setUpdating(orderId);
    try {
      await adminApi.put(`/online-orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order marked as ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update');
    } finally {
      setUpdating(null);
    }
  };

  const filtered = search.trim()
    ? orders.filter((o) =>
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_phone.includes(search)
      )
    : orders;

  const getNextStatus = (current: string) => {
    const idx = STATUS_FLOW.indexOf(current as any);
    if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null;
    return STATUS_FLOW[idx + 1];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Online Orders</h1>
        {summary && <span className="text-sm text-gray-500">{summary.total} total orders</span>}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['confirmed', 'packed', 'dispatched', 'delivered', 'cancelled'] as const).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const count = summary[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? 'all' : s)}
                className={`rounded-lg border p-3 text-left transition-all ${filter === s ? cfg.bg + ' border-2' : 'bg-white border-gray-200 hover:border-gray-300'}`}
              >
                <p className={`text-xs font-medium uppercase tracking-wide ${cfg.color}`}>{cfg.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order #, customer name, or phone…"
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
        />
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No orders found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.confirmed;
            const Icon = cfg.icon;
            const isExpanded = expandedId === order.id;
            const nextStatus = getNextStatus(order.status);
            const canCancel = order.status !== 'delivered' && order.status !== 'cancelled';

            return (
              <div key={order.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Order header row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg.split(' ')[0]}`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{order.order_number}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      {order.payment_method === 'cod' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">COD</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {order.customer_name} • {order.customer_phone} • {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-gray-900">${order.total_amount.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {/* Horizontal status timeline */}
                    <div className="py-4">
                      <div className="flex items-center justify-between max-w-lg mx-auto">
                        {STATUS_FLOW.map((s, i) => {
                          const sCfg = STATUS_CONFIG[s];
                          const SIcon = sCfg.icon;
                          const historyEntry = order.status_history.find((h) => h.status === s);
                          const currentFlowIdx = STATUS_FLOW.indexOf(order.status as any);
                          const done = i <= currentFlowIdx && order.status !== 'cancelled';
                          const isCurrent = order.status === s;
                          return (
                            <div key={s} className="flex flex-col items-center flex-1 relative">
                              {i > 0 && (
                                <div className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${done ? 'bg-[#0f766e]' : 'bg-gray-200'}`} />
                              )}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${done ? 'bg-[#0f766e] text-white' : 'bg-gray-200 text-gray-400'} ${isCurrent ? 'ring-2 ring-offset-2 ring-[#0f766e]' : ''}`}>
                                <SIcon className="w-4 h-4" />
                              </div>
                              <span className={`text-xs mt-2 capitalize ${done ? 'text-[#0f766e] font-medium' : 'text-gray-400'}`}>{sCfg.label}</span>
                              {historyEntry && (
                                <span className="text-[10px] text-gray-400 mt-0.5">
                                  {new Date(historyEntry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {order.status === 'cancelled' && (
                        <div className="text-center mt-3 text-sm text-red-600 font-medium">Order Cancelled</div>
                      )}
                    </div>

                    {/* Items table */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-500 text-xs uppercase">
                            <th className="text-left py-1">Product</th>
                            <th className="text-right py-1">Qty</th>
                            <th className="text-right py-1">Price</th>
                            <th className="text-right py-1">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              <td className="py-1.5 text-gray-900">{item.product_name}</td>
                              <td className="py-1.5 text-right">{item.quantity}</td>
                              <td className="py-1.5 text-right">${item.price.toFixed(2)}</td>
                              <td className="py-1.5 text-right font-medium">${item.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="border-t border-gray-300 mt-2 pt-2 space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>${order.tax_amount.toFixed(2)}</span></div>
                        <div className="flex justify-between font-semibold"><span>Total</span><span>${order.total_amount.toFixed(2)}</span></div>
                      </div>
                    </div>

                    {/* Customer & address info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Customer</p>
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-gray-600">{order.customer_email}</p>
                        <p className="text-gray-600">{order.customer_phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase mb-1">Shipping address</p>
                        <p className="text-gray-700">
                          {order.address_line1}
                          {order.address_line2 ? `, ${order.address_line2}` : ''}<br />
                          {order.city}, {order.state} {order.zip}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {(nextStatus || canCancel) && (
                      <div className="flex items-center gap-3 pt-3 border-t">
                        {nextStatus && (
                          <button
                            onClick={() => updateStatus(order.id, nextStatus)}
                            disabled={updating === order.id}
                            className="px-4 py-2 bg-[#0f766e] text-white rounded-lg font-medium text-sm hover:bg-[#0d5d57] disabled:opacity-50"
                          >
                            {updating === order.id ? 'Updating…' : `Mark as ${STATUS_CONFIG[nextStatus]?.label}`}
                          </button>
                        )}
                        {canCancel && (
                          <button
                            onClick={() => updateStatus(order.id, 'cancelled')}
                            disabled={updating === order.id}
                            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium text-sm hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel Order
                          </button>
                        )}
                        {order.invoice_id && (
                          <span className="text-xs text-green-600 ml-auto flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Invoice generated
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
