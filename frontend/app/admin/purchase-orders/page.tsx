'use client';

import { useEffect, useState } from 'react';
import { Plus, Eye, FileText, Truck, Search, X } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface POItem {
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received?: number;
  unit_cost: number;
  subtotal: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  supplier_id?: string;
  state?: string;
  city?: string;
  status: string;
  items: POItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

interface Vendor {
  id: string;
  supplier_id?: string;
  name: string;
  state?: string;
  city?: string;
}

interface Product {
  id: string;
  name: string;
  cost_price?: number;
}

interface CreateRow {
  product_id: string;
  product_name: string;
  qty: number;
  unit_cost: number;
  cost_excl_tax: number;
  tax_rate: number;
  total_tax: number;
  cost_incl_tax: number;
  shipping: number;
  total_price: number;
}

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorId, setVendorId] = useState('');
  const [billNum, setBillNum] = useState('');
  const [rows, setRows] = useState<CreateRow[]>([]);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [savedPoId, setSavedPoId] = useState<string | null>(null);

  const fetchPOs = async () => {
    try {
      const res = await adminApi.get('/purchase-orders', { params: search ? { search } : {} });
      setPos(res.data.purchase_orders || []);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await adminApi.get('/vendors');
      setVendors(res.data.vendors || []);
    } catch {
      toast.error('Failed to load vendors');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await adminApi.get('/products');
      setProducts(res.data.products || []);
    } catch {
      toast.error('Failed to load products');
    }
  };

  useEffect(() => {
    fetchPOs();
  }, [search]);

  useEffect(() => {
    if (showCreate) {
      fetchVendors();
      fetchProducts();
    }
  }, [showCreate]);

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  const generatePoId = async () => {
    try {
      const res = await adminApi.get('/purchase-orders/generate-id');
      setPoNumber(res.data.po_number);
    } catch {
      setPoNumber('P' + Math.floor(10000 + Math.random() * 90000));
    }
  };

  const addRow = () => {
    const first = products[0];
    setRows([
      ...rows,
      {
        product_id: first?.id ?? '',
        product_name: first?.name ?? '',
        qty: 1,
        unit_cost: 0,
        cost_excl_tax: 0,
        tax_rate: 0,
        total_tax: 0,
        cost_incl_tax: 0,
        shipping: 0,
        total_price: 0,
      },
    ]);
  };

  const updateRow = (idx: number, field: keyof CreateRow, value: string | number) => {
    const next = [...rows];
    const r = { ...next[idx], [field]: value };
    if (field === 'product_id') {
      const p = products.find((x) => x.id === value);
      r.product_name = p?.name ?? r.product_name;
      // Auto-fill unit cost from product's cost price (last purchase / current cost)
      r.unit_cost = p?.cost_price ?? 0;
    }
    if (field === 'qty' || field === 'unit_cost' || field === 'product_id') {
      const qty = field === 'qty' ? Number(value) : r.qty;
      const cost = field === 'unit_cost' ? Number(value) : r.unit_cost;
      r.cost_excl_tax = qty * cost;
      r.tax_rate = next[idx].tax_rate;
      r.total_tax = Math.round(r.cost_excl_tax * (r.tax_rate / 100) * 100) / 100;
      r.cost_incl_tax = r.cost_excl_tax + r.total_tax;
      r.shipping = next[idx].shipping;
      r.total_price = r.cost_incl_tax + r.shipping;
    }
    if (field === 'tax_rate') {
      r.tax_rate = Number(value);
      r.total_tax = Math.round(r.cost_excl_tax * (r.tax_rate / 100) * 100) / 100;
      r.cost_incl_tax = r.cost_excl_tax + r.total_tax;
      r.total_price = r.cost_incl_tax + r.shipping;
    }
    if (field === 'shipping') {
      r.shipping = Number(value);
      r.total_price = r.cost_incl_tax + r.shipping;
    }
    next[idx] = r;
    setRows(next);
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter((r) => r.product_id && r.qty > 0 && r.unit_cost >= 0);
    if (!vendorId || validRows.length === 0) {
      toast.error('Select supplier and add at least one item');
      return;
    }
    try {
      const res = await adminApi.post('/purchase-orders', {
        po_number: poNumber || undefined,
        vendor_id: vendorId,
        items: validRows.map((r) => ({
          product_id: r.product_id,
          product_name: r.product_name,
          quantity_ordered: r.qty,
          unit_cost: r.unit_cost,
        })),
        tax_amount: validRows.reduce((s, r) => s + r.total_tax, 0),
        notes: billNum ? `Bill #${billNum}` : undefined,
      });
      toast.success('PO saved');
      setShowCreate(false);
      setPoNumber('');
      setPoDate(new Date().toISOString().slice(0, 10));
      setVendorId('');
      setBillNum('');
      setRows([]);
      setSavedPoId(res.data?.id ?? null);
      setShowPdfModal(true);
      fetchPOs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save PO');
    }
  };

  const pmtStatus = (po: PurchaseOrder) => {
    if (po.status === 'received') return 'Paid';
    if (po.status === 'partial') return 'Partial PMT';
    return 'Pending';
  };

  const shippingStatus = (po: PurchaseOrder) => {
    if (po.status === 'received') return 'Received';
    if (po.status === 'partial') return 'Partial';
    return 'Pending';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
      <div className="bg-white rounded-xl shadow-md p-4 mt-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search POs by number, supplier, bill #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const emptyRow = (): CreateRow => ({
                product_id: '',
                product_name: '',
                qty: 1,
                unit_cost: 0,
                cost_excl_tax: 0,
                tax_rate: 0,
                total_tax: 0,
                cost_incl_tax: 0,
                shipping: 0,
                total_price: 0,
              });
              setShowCreate(true);
              setPoNumber('');
              setPoDate(new Date().toISOString().slice(0, 10));
              setVendorId('');
              setBillNum('');
              setRows(Array.from({ length: 15 }, emptyRow));
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-[#0f766e] hover:bg-[#0d5d57]"
          >
            <Plus className="w-4 h-4" />
            New PO
          </button>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="All">All</option>
          </select>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-xl shadow overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0f766e] border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#0f766e] text-white">
                  <th className="text-left py-3 px-4 text-sm font-medium">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">PO ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Supplier ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Supplier Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Bill Num</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">State</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">City</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Total Amount</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Total Paid</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">PO Balance</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">PMT Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Shipping Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-gray-500">
                      No purchase orders. Click &quot;New PO&quot; to create one.
                    </td>
                  </tr>
                ) : (
                  pos.map((po, i) => (
                    <tr key={po.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-4 text-sm">{po.created_at ? new Date(po.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}</td>
                      <td className="py-2 px-4 text-sm font-medium">{po.po_number}</td>
                      <td className="py-2 px-4 text-sm">{po.supplier_id || '—'}</td>
                      <td className="py-2 px-4 text-sm">{po.vendor_name}</td>
                      <td className="py-2 px-4 text-sm">—</td>
                      <td className="py-2 px-4 text-sm">{po.state || '—'}</td>
                      <td className="py-2 px-4 text-sm">{po.city || '—'}</td>
                      <td className="py-2 px-4 text-sm text-right">{Number(po.total_amount || 0).toLocaleString()}</td>
                      <td className="py-2 px-4 text-sm text-right">0</td>
                      <td className="py-2 px-4 text-sm text-right">{Number(po.total_amount || 0).toLocaleString()}</td>
                      <td className="py-2 px-4 text-sm">{pmtStatus(po)}</td>
                      <td className="py-2 px-4 text-sm">{shippingStatus(po)}</td>
                      <td className="py-2 px-4 text-right">
                        <Link href={`/admin/purchase-orders/${po.id}`} className="inline-flex items-center gap-1 text-[#0f766e] hover:underline text-sm font-medium">
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Create New PO</h2>
            </div>

            <form onSubmit={handleSavePO} className="p-6 space-y-6">
              <section>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">PO Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">PO ID *</label>
                      <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g. P087684" />
                    </div>
                    <div className="pt-7">
                      <button type="button" onClick={generatePoId} className="px-3 py-2 rounded-lg text-white text-sm font-medium bg-blue-600 hover:bg-blue-700">
                        Generate
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PO Date *</label>
                    <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
                    <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                      <option value="">Select supplier</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                    <input type="text" value={selectedVendor?.supplier_id ?? ''} readOnly className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input type="text" value={selectedVendor?.state ?? ''} readOnly className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input type="text" value={selectedVendor?.city ?? ''} readOnly className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bill Num</label>
                    <input type="text" value={billNum} onChange={(e) => setBillNum(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">PO Items</h3>
                  <button type="button" onClick={addRow} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-white text-sm font-medium bg-[#0f766e] hover:bg-[#0d5d57]">
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Product</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Qty</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Unit cost</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Cost excl tax</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Tax %</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Total tax</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Cost incl tax</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Shipping</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Line total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50/60">
                          <td className="py-2 px-4">
                            <select
                              value={r.product_id}
                              onChange={(e) => updateRow(idx, 'product_id', e.target.value)}
                              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            >
                              <option value="">Select product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              min={1}
                              value={r.qty}
                              onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.unit_cost || ''}
                              onChange={(e) => updateRow(idx, 'unit_cost', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="py-2 px-4 text-right text-sm">{r.cost_excl_tax.toFixed(2)}</td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={r.tax_rate || ''}
                              onChange={(e) => updateRow(idx, 'tax_rate', e.target.value)}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="py-2 px-4 text-right text-sm">{r.total_tax.toFixed(2)}</td>
                          <td className="py-2 px-4 text-right text-sm">{r.cost_incl_tax.toFixed(2)}</td>
                          <td className="py-2 px-4 text-right">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={r.shipping || ''}
                              onChange={(e) => updateRow(idx, 'shipping', e.target.value)}
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            />
                          </td>
                          <td className="py-2 px-4 text-right text-sm font-medium">{r.total_price.toFixed(2)}</td>
                          <td className="py-2 px-4">
                            <button type="button" onClick={() => removeRow(idx)} className="text-red-600 hover:bg-red-50 rounded p-1">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Close
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-white font-medium bg-[#0f766e] hover:bg-[#0d5d57]">
                  Save PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPdfModal && savedPoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">PO saved</h3>
            <p className="text-gray-600 text-sm mb-4">Download or print the PDF.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await adminApi.get(`/purchase-orders/${savedPoId}/pdf`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `po-${savedPoId}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    toast.success('PDF downloaded');
                  } catch {
                    toast.error('Failed to download PDF');
                  }
                }}
                className="w-full px-4 py-2.5 rounded-lg font-medium bg-[#0f766e] text-white hover:bg-[#0d6b63]"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await adminApi.get(`/purchase-orders/${savedPoId}/pdf`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const w = window.open(url, '_blank');
                    if (w) w.onload = () => w.print();
                    toast.success('Opening print dialog');
                  } catch {
                    toast.error('Failed to open PDF for printing');
                  }
                }}
                className="w-full px-4 py-2.5 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Print PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPdfModal(false);
                  setSavedPoId(null);
                }}
                className="w-full px-4 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
