'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, CheckCircle, XCircle, X, FileText, Trash2, Download } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';
import SearchableProductDropdown from '@/components/admin/SearchableProductDropdown';

interface CreditMemoItem {
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  tax_percent?: number;
  tax_amount?: number;
  total?: number;
}

interface CreditMemo {
  id: string;
  credit_memo_number: string;
  type: 'VENDOR' | 'CUSTOMER';
  reference_invoice_id?: string;
  vendor_id?: string;
  vendor_name?: string;
  customer_id?: string;
  customer_name?: string;
  reason: string;
  affects_inventory: boolean;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  document_url?: string;
  notes?: string;
  created_at: string;
  approved_at?: string;
  items?: CreditMemoItem[];
}

const REASONS = ['DAMAGED', 'RATE_DIFFERENCE', 'RETURN', 'SCHEME', 'OTHER'] as const;
const STATUS_OPTIONS = ['', 'DRAFT', 'APPROVED', 'ADJUSTED', 'CLOSED', 'CANCELLED'];

export default function CreditMemosPage() {
  const searchParams = useSearchParams();
  const [list, setList] = useState<CreditMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CreditMemo | null>(null);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; sku?: string; price?: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [savedCreditMemoId, setSavedCreditMemoId] = useState<string | null>(null);
  const emptyLine = (): { product_id: string; product_name: string; quantity: number; unit_price: number; tax_percent: number } => ({ product_id: '', product_name: '', quantity: 1, unit_price: 0, tax_percent: 0 });
  const [form, setForm] = useState({
    type: 'CUSTOMER' as 'VENDOR' | 'CUSTOMER',
    vendor_id: '',
    customer_id: '',
    reason: 'RETURN' as (typeof REASONS)[number],
    affects_inventory: true,
    reference_invoice_id: '',
    notes: '',
    tax_percent: 0,
    items: Array.from({ length: 15 }, emptyLine) as {
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      tax_percent: number;
    }[],
  });

  const fetchList = async () => {
    try {
      const params: Record<string, string | number> = { page: 1, limit: 100 };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await adminApi.get('/credit-memos', { params });
      setList(res.data.credit_memos || []);
    } catch {
      toast.error('Failed to load credit memos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    const newParam = searchParams?.get('new');
    const customerId = searchParams?.get('customer_id');
    if (newParam === '1' && customerId) {
      setForm((f) => ({ ...f, type: 'CUSTOMER', customer_id: customerId }));
      setShowModal(true);
    }
  }, [searchParams]);

  const fetchDetail = async (id: string) => {
    try {
      const res = await adminApi.get(`/credit-memos/${id}`);
      setDetail(res.data);
    } catch {
      toast.error('Failed to load credit memo');
    }
  };

  useEffect(() => {
    if (detailId) fetchDetail(detailId);
    else setDetail(null);
  }, [detailId]);

  useEffect(() => {
    if (showModal) {
      adminApi.get('/vendors', { params: { limit: 500 } }).then((r) => setVendors(r.data.vendors || [])).catch(() => {});
      adminApi.get('/customers', { params: { limit: 500 } }).then((r) => setCustomers(r.data.customers || [])).catch(() => {});
      adminApi.get('/products', { params: { limit: 500 } }).then((r) => setProducts(r.data.products || [])).catch(() => {});
    }
  }, [showModal]);

  const filteredList = search.trim()
    ? list.filter(
        (cm) =>
          cm.credit_memo_number?.toLowerCase().includes(search.toLowerCase()) ||
          cm.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
          cm.customer_name?.toLowerCase().includes(search.toLowerCase())
      )
    : list;

  const openNew = () => {
    setForm({
      type: 'CUSTOMER',
      vendor_id: '',
      customer_id: '',
      reason: 'RETURN',
      affects_inventory: true,
      reference_invoice_id: '',
      notes: '',
      tax_percent: 0,
      items: Array.from({ length: 15 }, emptyLine),
    });
    setShowModal(true);
  };

  const addLine = () => {
    setForm((f) => ({ ...f, items: [...f.items, emptyLine()] }));
  };

  const updateLine = (index: number, field: string, value: string | number) => {
    setForm((f) => {
      const items = [...f.items];
      if (!items[index]) return f;

      if (field === 'product_id') {
        const productId = String(value);
        const p = products.find((x) => x.id === productId);
        if (p) {
          const existingIdx = items.findIndex((l, i) => i !== index && l.product_id === productId);
          if (existingIdx !== -1) {
            items[existingIdx] = { ...items[existingIdx], quantity: items[existingIdx].quantity + (items[index].quantity || 1) };
            items[index] = emptyLine();
          } else {
            items[index] = { ...items[index], product_id: productId, product_name: p.name, unit_price: p.price ?? 0 };
          }
        }
      } else {
        (items[index] as any)[field] = value;
      }
      return { ...f, items };
    });
  };

  const removeLine = (index: number) => {
    setForm((f) => {
      const next = f.items.filter((_, i) => i !== index);
      return { ...f, items: next.length ? next : [emptyLine()] };
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.type === 'VENDOR' && !form.vendor_id) {
      toast.error('Select a vendor');
      return;
    }
    if (form.type === 'CUSTOMER' && !form.customer_id) {
      toast.error('Select a customer');
      return;
    }
    const validItems = form.items.filter((i) => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one line item');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        type: form.type,
        vendor_id: form.type === 'VENDOR' ? form.vendor_id || undefined : undefined,
        customer_id: form.type === 'CUSTOMER' ? form.customer_id || undefined : undefined,
        reason: form.reason,
        affects_inventory: form.affects_inventory,
        reference_invoice_id: form.reference_invoice_id || undefined,
        notes: form.notes || undefined,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          tax_percent: Number(form.tax_percent) || 0,
        })),
      };
      const res = await adminApi.post('/credit-memos', payload);
      toast.success('Credit memo created');
      setShowModal(false);
      setSavedCreditMemoId(res.data?.id ?? null);
      setShowPdfModal(true);
      fetchList();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this credit memo? This will update ledger and optionally inventory.')) return;
    try {
      await adminApi.post(`/credit-memos/${id}/approve`);
      toast.success('Credit memo approved');
      fetchList();
      if (detailId === id) fetchDetail(id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this credit memo?')) return;
    try {
      await adminApi.post(`/credit-memos/${id}/cancel`);
      toast.success('Credit memo cancelled');
      fetchList();
      if (detailId === id) setDetailId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to cancel');
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Credit Memos</h1>
      <div className="bg-white rounded-xl shadow-md p-4 mt-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search credit memos by number, vendor, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-[#0f766e] hover:bg-[#0d5d57]"
          >
            <Plus className="w-4 h-4" />
            New Credit Memo
          </button>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="VENDOR">Vendor</option>
            <option value="CUSTOMER">Customer</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchList()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-white text-sm font-medium bg-[#0f766e]"
          >
            <Search className="w-4 h-4" />
            Refresh
          </button>
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
                  <th className="text-left py-3 px-4 text-sm font-medium">Number</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Vendor / Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Reason</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Created</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No credit memos. Click &quot;New Credit Memo&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((cm, i) => (
                    <tr key={cm.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-4 text-sm font-medium">{cm.credit_memo_number}</td>
                      <td className="py-2 px-4 text-sm">{cm.type}</td>
                      <td className="py-2 px-4 text-sm">{cm.type === 'VENDOR' ? cm.vendor_name : cm.customer_name}</td>
                      <td className="py-2 px-4 text-sm">{cm.reason}</td>
                      <td className="py-2 px-4 text-sm text-right">{Number(cm.total_amount).toLocaleString()}</td>
                      <td className="py-2 px-4 text-sm">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            cm.status === 'APPROVED'
                              ? 'bg-green-100 text-green-800'
                              : cm.status === 'DRAFT'
                                ? 'bg-gray-100 text-gray-800'
                                : cm.status === 'CANCELLED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {cm.status}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-sm">{formatDate(cm.created_at)}</td>
                      <td className="py-2 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setDetailId(detailId === cm.id ? null : cm.id)}
                            className="text-[#0f766e] hover:underline text-sm font-medium"
                          >
                            {detailId === cm.id ? 'Hide' : 'View'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await adminApi.get(`/credit-memos/${cm.id}/pdf`, { responseType: 'blob' });
                                const url = window.URL.createObjectURL(new Blob([res.data]));
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `credit-memo-${cm.credit_memo_number || cm.id}.pdf`;
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                window.URL.revokeObjectURL(url);
                                toast.success('PDF downloaded');
                              } catch {
                                toast.error('Failed to download PDF');
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[#0f766e] hover:underline text-sm font-medium"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                          {cm.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => handleApprove(cm.id)}
                              className="text-green-600 hover:underline text-sm font-medium"
                            >
                              Approve
                            </button>
                          )}
                          {(cm.status === 'DRAFT' || cm.status === 'APPROVED') && (
                            <button
                              type="button"
                              onClick={() => handleCancel(cm.id)}
                              className="text-red-600 hover:underline text-sm"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && detail && (
        <div className="mt-6 bg-white rounded-xl shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              <FileText className="w-5 h-5 inline mr-2" />
              {detail.credit_memo_number} — {detail.status}
            </h2>
            <button type="button" onClick={() => setDetailId(null)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Type:</span> {detail.type}</div>
            <div><span className="text-gray-500">Party:</span> {detail.type === 'VENDOR' ? detail.vendor_name : detail.customer_name}</div>
            <div><span className="text-gray-500">Reason:</span> {detail.reason}</div>
            <div><span className="text-gray-500">Affects inventory:</span> {detail.affects_inventory ? 'Yes' : 'No'}</div>
            <div><span className="text-gray-500">Subtotal:</span> {Number(detail.subtotal).toLocaleString()}</div>
            <div><span className="text-gray-500">Tax:</span> {Number(detail.tax_amount).toLocaleString()}</div>
            <div><span className="text-gray-500">Total:</span> {Number(detail.total_amount).toLocaleString()}</div>
            <div><span className="text-gray-500">Created:</span> {formatDate(detail.created_at)}</div>
            {detail.notes && <div className="col-span-2"><span className="text-gray-500">Notes:</span> {detail.notes}</div>}
          </div>
          {detail.items && detail.items.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Line items</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Product</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Unit price</th>
                    <th className="text-right py-2">Tax %</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-1">{item.product_name || item.product_id}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{Number(item.unit_price).toLocaleString()}</td>
                      <td className="text-right">{item.tax_percent ?? 0}%</td>
                      <td className="text-right">{Number(item.total ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">New Credit Memo</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'VENDOR' | 'CUSTOMER', vendor_id: '', customer_id: '' }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    <option value="VENDOR">Vendor</option>
                    <option value="CUSTOMER">Customer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{form.type === 'VENDOR' ? 'Vendor *' : 'Customer *'}</label>
                  {form.type === 'VENDOR' ? (
                    <select value={form.vendor_id} onChange={(e) => setForm((f) => ({ ...f, vendor_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                      <option value="">Select vendor</option>
                      {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                    </select>
                  ) : (
                    <select value={form.customer_id} onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" required>
                      <option value="">Select customer</option>
                      {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value as (typeof REASONS)[number] }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                    {REASONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.affects_inventory} onChange={(e) => setForm((f) => ({ ...f, affects_inventory: e.target.checked }))} className="rounded border-gray-300 text-[#0f766e]" />
                    <span className="text-sm">Affects inventory</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference invoice ID</label>
                  <input type="text" value={form.reference_invoice_id} onChange={(e) => setForm((f) => ({ ...f, reference_invoice_id: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Optional" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Line items *</label>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-3 w-10">#</th>
                        <th className="text-left py-3 px-3 min-w-[200px]">Product</th>
                        <th className="text-right py-3 px-3 w-20">Qty</th>
                        <th className="text-right py-3 px-3 w-28">Unit price</th>
                        <th className="text-right py-3 px-3 w-28">Amount</th>
                        <th className="w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((line, idx) => {
                        const qty = Number(line.quantity) || 0;
                        const price = Number(line.unit_price) || 0;
                        const lineTotal = qty * price;
                        const hasProduct = !!(line.product_id || line.product_name);
                        return (
                          <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50/60">
                            <td className="py-2 px-3 text-xs text-gray-500">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <SearchableProductDropdown
                                products={products}
                                value={line.product_id}
                                displayName={line.product_name || undefined}
                                onSelect={(p) => updateLine(idx, 'product_id', p.id)}
                                placeholder="Search product or scan barcode…"
                              />
                            </td>
                            <td className="py-2 px-3 text-right">
                              {hasProduct ? (
                                <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                              ) : (
                                <span className="text-gray-400">{line.quantity || ''}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {hasProduct ? (
                                <input type="number" min={0} step={0.01} value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right" />
                              ) : (
                                <span className="text-gray-400" />
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-medium">{hasProduct ? `$${lineTotal.toFixed(2)}` : ''}</td>
                            <td className="py-2 px-3">
                              {hasProduct && (
                                <button type="button" onClick={() => removeLine(idx)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-start justify-between">
                  <button type="button" onClick={addLine} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50">
                    + Add line
                  </button>
                  {(() => {
                    const subtotal = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
                    const taxRate = Number(form.tax_percent) || 0;
                    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
                    const total = subtotal + taxAmount;
                    return (
                      <div className="w-72 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Tax (%)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={form.tax_percent || ''}
                            onChange={(e) => setForm((f) => ({ ...f, tax_percent: Number(e.target.value) || 0 }))}
                            className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax amount</span>
                          <span className="font-medium">${taxAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2 font-semibold text-gray-900">
                          <span>Total</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Close</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg text-white font-medium bg-[#0f766e] hover:bg-[#0d5d57] disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPdfModal && savedCreditMemoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Credit memo saved</h3>
            <p className="text-gray-600 text-sm mb-4">Download or print the PDF.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await adminApi.get(`/credit-memos/${savedCreditMemoId}/pdf`, { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `credit-memo-${savedCreditMemoId}.pdf`;
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
                    const res = await adminApi.get(`/credit-memos/${savedCreditMemoId}/pdf`, { responseType: 'blob' });
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
                  setSavedCreditMemoId(null);
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
