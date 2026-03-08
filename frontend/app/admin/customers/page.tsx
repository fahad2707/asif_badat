'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Edit, Search, User, Trash2, FileDown, X, FileText, DollarSign, ChevronDown } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';
import ReceivePaymentLightbox from '@/components/admin/ReceivePaymentLightbox';

interface CustomerDoc {
  name: string;
  url: string;
}

interface Customer {
  id: string;
  customer_code?: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  address?: string;
  billing_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  payment_terms?: string;
  credit_limit?: number;
  notes?: string;
  documents?: CustomerDoc[];
}

interface InvoiceSummary {
  id: string;
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  total_amount: number;
  amount_paid?: number;
  payment_status: string;
}

interface InvoiceSummaryStats {
  overdueTotal?: number;
  overdueCount?: number;
  openTotal?: number;
  openCount?: number;
  paidCount?: number;
  recentlyPaidTotal?: number;
  totalPaid?: number;
  totalUnpaid?: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editIdFromUrl = searchParams?.get('edit');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>({ name: '', phone: '', email: '', company: '', address: '', billing_address: '', city: '', state: '', zip: '', payment_terms: '', notes: '', customer_code: '' });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [detailInvoices, setDetailInvoices] = useState<InvoiceSummary[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [customerFormDirty, setCustomerFormDirty] = useState(false);
  const [showCustomerCloseConfirm, setShowCustomerCloseConfirm] = useState(false);
  const [summary, setSummary] = useState<InvoiceSummaryStats | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [receivePaymentCustomerId, setReceivePaymentCustomerId] = useState<string | undefined>();
  const [actionDropdownId, setActionDropdownId] = useState<string | null>(null);
  const [actionDropdownAnchor, setActionDropdownAnchor] = useState<DOMRect | null>(null);
  const apiBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '') : '';

  const fetchCustomers = async () => {
    try {
      const res = await adminApi.get('/customers', { params: { ...(search ? { search } : {}), limit: 500 } });
      setCustomers(res.data.customers || []);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await adminApi.get('/invoices/summary');
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await adminApi.get('/customers/balances');
      const map: Record<string, number> = {};
      (res.data.balances || []).forEach((b: { customer_id: string; open_balance: number }) => {
        if (b.customer_id) map[b.customer_id] = b.open_balance ?? 0;
      });
      setBalances(map);
    } catch {
      setBalances({});
    }
  };

  const refreshDetailCustomer = async (customerId: string) => {
    try {
      const res = await adminApi.get(`/customers/${customerId}`);
      setDetailCustomer(res.data);
    } catch {
      // ignore
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, customerId: string) => {
    const file = e.target.files?.[0];
    if (!file || !customerId) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await adminApi.post(`/customers/${customerId}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded');
      await refreshDetailCustomer(customerId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  useEffect(() => {
    fetchSummary();
    fetchBalances();
  }, []);

  useEffect(() => {
    if (!editIdFromUrl || customers.length === 0) return;
    const c = customers.find((x) => String(x.id) === String(editIdFromUrl));
    if (c) {
      openEdit(c);
      router.replace('/admin/customers', { scroll: false });
    }
  }, [editIdFromUrl, customers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.phone?.trim()) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      if (editing) {
        await adminApi.put(`/customers/${editing.id}`, form);
        toast.success('Customer updated');
      } else {
        const res = await adminApi.post('/customers', { ...form, email: form.email || undefined });
        const created = res.data;
        const fileInput = document.getElementById('customer-docs-form') as HTMLInputElement;
        if (fileInput?.files?.length) {
          for (let i = 0; i < fileInput.files.length; i++) {
            const fd = new FormData();
            fd.append('file', fileInput.files[i]);
            await adminApi.post(`/customers/${created.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          }
        }
        if (fileInput) fileInput.value = '';
        toast.success('Customer created');
      }
      setShowModal(false);
      setEditing(null);
      setCustomerFormDirty(false);
      setShowCustomerCloseConfirm(false);
      setForm({ name: '', phone: '', email: '', company: '', address: '', billing_address: '', city: '', state: '', zip: '', payment_terms: '', notes: '', customer_code: '' });
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const generateCustomerCode = () => {
    adminApi.get('/customers/generate-id').then((r) => {
      setForm((f) => ({ ...f, customer_code: r.data.customer_code || '' }));
      setCustomerFormDirty(true);
    }).catch(() => toast.error('Failed to generate customer code'));
  };

  const handleCustomerModalClose = () => {
    if (customerFormDirty) {
      setShowCustomerCloseConfirm(true);
      return;
    }
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', phone: '', email: '', company: '', address: '', billing_address: '', city: '', state: '', zip: '', payment_terms: '', notes: '', customer_code: '' });
  };

  const handleCustomerCloseWithoutSaving = () => {
    setShowCustomerCloseConfirm(false);
    setCustomerFormDirty(false);
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', phone: '', email: '', company: '', address: '', billing_address: '', city: '', state: '', zip: '', payment_terms: '', notes: '', customer_code: '' });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(customers.map((c) => c.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Deactivate ${selectedIds.size} selected customer(s)?`)) return;
    try {
      await adminApi.post('/customers/bulk-delete', { ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} customer(s) deactivated`);
      setSelectedIds(new Set());
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    const rows = customers.filter((c) => selectedIds.has(c.id));
    const headers = ['Name', 'Company', 'Phone', 'Email', 'Address', 'City', 'State', 'ZIP', 'Payment Terms'];
    const csvRows = [
      headers.join(','),
      ...rows.map((c) =>
        [
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.company || '').replace(/"/g, '""')}"`,
          `"${(c.phone || '').replace(/"/g, '""')}"`,
          `"${(c.email || '').replace(/"/g, '""')}"`,
          `"${(c.address || '').replace(/"/g, '""')}"`,
          `"${(c.city || '').replace(/"/g, '""')}"`,
          `"${(c.state || '').replace(/"/g, '""')}"`,
          `"${(c.zip || '').replace(/"/g, '""')}"`,
          `"${(c.payment_terms || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} customer(s). Open in Excel.`);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setCustomerFormDirty(false);
    setForm({
      name: c.name,
      customer_code: c.customer_code,
      company: c.company,
      phone: c.phone,
      email: c.email,
      address: c.address,
      billing_address: c.billing_address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      payment_terms: c.payment_terms,
      credit_limit: c.credit_limit,
      notes: c.notes,
    });
    setShowModal(true);
  };

  const openDetail = (c: Customer) => {
    router.push(`/admin/customers/${c.id}`);
  };

  const openReceivePayment = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionDropdownId(null);
    setReceivePaymentCustomerId(customerId);
    setReceivePaymentOpen(true);
  };

  const openCreateInvoice = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionDropdownId(null);
    router.push(`/admin/customers/${c.id}?newInvoice=1`);
  };

  const detailPaid = detailInvoices.filter((i) => (i.payment_status || '').toLowerCase() === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0);
  const detailUnpaid = detailInvoices.filter((i) => (i.payment_status || '').toLowerCase() !== 'paid').reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);

  const getOpenBalance = (customerId: string) => balances[customerId] ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2 border border-gray-300"
          >
            Customer types <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setCustomerFormDirty(false);
              setForm({ name: '', phone: '', email: '', company: '', address: '', billing_address: '', city: '', state: '', zip: '', payment_terms: '', notes: '', customer_code: '' });
              setShowModal(true);
            }}
            className="bg-[#0f766e] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#0d6b63] flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New customer
          </button>
        </div>
      </div>

      {/* Payment status bar */}
      {summary && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-3">
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <p className="text-2xl font-bold text-gray-900">$0</p>
              <p className="text-sm text-gray-500">0 estimates</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <p className="text-2xl font-bold text-gray-900">$0</p>
              <p className="text-sm text-gray-500">Unbilled income</p>
            </div>
            <button type="button" onClick={() => router.push('/admin/invoices?unpaid_only=1')} className="text-center p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors">
              <p className="text-2xl font-bold text-purple-700">${Number(summary.overdueTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-gray-600">{(summary.overdueCount ?? 0)} overdue invoices</p>
            </button>
            <button type="button" onClick={() => router.push('/admin/invoices?unpaid_only=1')} className="text-center p-3 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors">
              <p className="text-2xl font-bold text-amber-700">${Number(summary.openTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-gray-600">{(summary.openCount ?? 0)} open invoices and credits</p>
            </button>
            <div className="text-center p-3 rounded-lg bg-green-50">
              <p className="text-2xl font-bold text-green-700">${Number(summary.recentlyPaidTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <p className="text-sm text-gray-600">{(summary.paidCount ?? 0)} recently paid</p>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-gray-100">
            {(() => {
              const total = (Number(summary.openTotal) || 0) + (Number(summary.recentlyPaidTotal) || 0) || 1;
              const overdueW = ((Number(summary.overdueTotal) || 0) / total) * 100;
              const openW = ((Number(summary.openTotal) || 0) - (Number(summary.overdueTotal) || 0)) / total * 100;
              const recentW = (Number(summary.recentlyPaidTotal) || 0) / total * 100;
              return (
                <>
                  <div className="bg-purple-500 h-full transition-all" style={{ width: `${Math.max(0, overdueW)}%` }} title="Overdue" />
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${Math.max(0, openW)}%` }} title="Open" />
                  <div className="bg-green-500 h-full flex-1 transition-all" style={{ width: `${Math.max(0, recentW)}%` }} title="Recently paid" />
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, company, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">{selectedIds.size} selected</span>
            <button type="button" onClick={handleExportSelected} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2">
              <FileDown className="w-4 h-4" /> Export to Excel
            </button>
            <button type="button" onClick={handleBulkDelete} className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Delete selected
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-gray-600 hover:text-gray-900 text-sm font-medium">Clear selection</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f766e]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 py-3 px-4">
                  <input type="checkbox" checked={customers.length > 0 && selectedIds.size === customers.length} onChange={toggleSelectAll} className="rounded border-gray-300 text-[#0f766e] focus:ring-[#0f766e] focus:border-[#0f766e]" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">NAME</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">COMPANY NAME</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">PHONE</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">OPEN BALANCE</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const openBal = getOpenBalance(c.id);
                return (
                  <tr key={c.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded border-gray-300 text-[#0f766e] focus:ring-[#0f766e] focus:border-[#0f766e]" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900">{c.name}</span>
                        {c.customer_code && <span className="text-xs text-gray-500">({c.customer_code})</span>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">{c.company || '—'}</td>
                    <td className="py-3 px-4 text-gray-700">{c.phone}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">${openBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (actionDropdownId === c.id) {
                              setActionDropdownId(null);
                              setActionDropdownAnchor(null);
                            } else {
                              setActionDropdownId(c.id);
                              setActionDropdownAnchor(e.currentTarget.getBoundingClientRect());
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#0f766e] text-white hover:bg-[#0d6b63]"
                        >
                          {openBal > 0 ? 'Receive payment' : 'Create invoice'}
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {customers.length === 0 && (
            <div className="text-center py-12 text-gray-500">No customers found. Add your first customer above.</div>
          )}
        </div>
      )}

      {typeof document !== 'undefined' && actionDropdownId && actionDropdownAnchor && (() => {
        const c = customers.find((x) => x.id === actionDropdownId);
        if (!c) return null;
        const openBal = getOpenBalance(c.id);
        const closeDropdown = () => { setActionDropdownId(null); setActionDropdownAnchor(null); };
        return createPortal(
          <>
            <div className="fixed inset-0 z-[100]" aria-hidden onClick={(e) => { e.stopPropagation(); closeDropdown(); }} />
            <div
              className="fixed z-[101] py-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[160px]"
              style={{ top: actionDropdownAnchor.bottom + 4, right: typeof window !== 'undefined' ? window.innerWidth - actionDropdownAnchor.right : 0 }}
            >
              {openBal > 0 && (
                <button type="button" onClick={(e) => { openReceivePayment(c.id, e); closeDropdown(); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Receive payment
                </button>
              )}
              <button type="button" onClick={(e) => { openCreateInvoice(c, e); closeDropdown(); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Create invoice
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(c); closeDropdown(); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Edit customer
              </button>
            </div>
          </>,
          document.body
        );
      })()}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCustomerModalClose}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button type="button" onClick={handleCustomerModalClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form id="customer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name || ''}
                    onChange={(e) => { setForm({ ...form, name: e.target.value }); setCustomerFormDirty(true); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                    required
                  />
                </div>
                {!editing && (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                      <input
                        type="text"
                        value={form.customer_code || ''}
                        onChange={(e) => { setForm({ ...form, customer_code: e.target.value }); setCustomerFormDirty(true); }}
                        placeholder="Auto-generated if left blank"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                      />
                    </div>
                    <div className="pt-6">
                      <button type="button" onClick={generateCustomerCode} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Generate</button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="text"
                    value={form.phone || ''}
                    onChange={(e) => { setForm({ ...form, phone: e.target.value }); setCustomerFormDirty(true); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => { setForm({ ...form, email: e.target.value }); setCustomerFormDirty(true); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                  <input
                    type="text"
                    value={form.company || ''}
                    onChange={(e) => { setForm({ ...form, company: e.target.value }); setCustomerFormDirty(true); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address / Bill to</label>
                  <textarea
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing address (if different)</label>
                  <input
                    type="text"
                    value={form.billing_address || ''}
                    onChange={(e) => { setForm({ ...form, billing_address: e.target.value }); setCustomerFormDirty(true); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={form.city || ''}
                      onChange={(e) => { setForm({ ...form, city: e.target.value }); setCustomerFormDirty(true); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={form.state || ''}
                      onChange={(e) => { setForm({ ...form, state: e.target.value }); setCustomerFormDirty(true); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={form.zip || ''}
                      onChange={(e) => { setForm({ ...form, zip: e.target.value }); setCustomerFormDirty(true); }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment terms</label>
                  <select
                    value={form.payment_terms || ''}
                    onChange={(e) => { setForm({ ...form, payment_terms: e.target.value }); setCustomerFormDirty(true); }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                  >
                    <option value="">Select payment terms</option>
                    <option value="Due on receipt">Due on receipt</option>
                    <option value="Net 7">Net 7</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={form.notes || ''}
                    onChange={(e) => { setForm({ ...form, notes: e.target.value }); setCustomerFormDirty(true); }}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
                  />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload documents (PDF, JPG)</label>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="w-full text-sm text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700" id="customer-docs-form" />
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-[#0f766e] text-white py-2 rounded-lg font-semibold hover:bg-[#0d6b63]">
                    {editing ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomerModalClose}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            {showCustomerCloseConfirm && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl z-10 p-4">
                <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm w-full">
                  <p className="text-gray-900 font-medium mb-3">You have unsaved changes.</p>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={handleCustomerCloseWithoutSaving} className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Continue without saving</button>
                    <button type="button" onClick={() => { setShowCustomerCloseConfirm(false); const f = document.getElementById('customer-form'); if (f) (f as HTMLFormElement).requestSubmit(); }} className="px-3 py-2 bg-[#0f766e] text-white rounded-lg hover:bg-[#0d6b63]">Save and close</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {detailCustomer && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50" onClick={() => setDetailCustomer(null)}>
          <div className="bg-white w-full max-w-xl shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Customer details</h2>
              <button type="button" onClick={() => setDetailCustomer(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900">{detailCustomer.name}</h3>
                {detailCustomer.customer_code && <p className="text-sm text-gray-500">ID: {detailCustomer.customer_code}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Phone</span><br />{detailCustomer.phone}</div>
                <div><span className="text-gray-500">Email</span><br />{detailCustomer.email || '—'}</div>
                <div className="col-span-2"><span className="text-gray-500">Company</span><br />{detailCustomer.company || '—'}</div>
                <div className="col-span-2"><span className="text-gray-500">Address</span><br />{[detailCustomer.address, detailCustomer.city, detailCustomer.state, detailCustomer.zip].filter(Boolean).join(', ') || '—'}</div>
                <div className="col-span-2"><span className="text-gray-500">Payment terms</span><br />{detailCustomer.payment_terms || '—'}</div>
                {detailCustomer.notes && <div className="col-span-2"><span className="text-gray-500">Notes</span><br />{detailCustomer.notes}</div>}
              </div>
              <div className="flex gap-4 py-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Paid: <strong className="text-green-700">${detailPaid.toFixed(2)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-gray-700">Unpaid: <strong className="text-amber-700">${detailUnpaid.toFixed(2)}</strong></span>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> Documents</h4>
                {(detailCustomer.documents?.length ?? 0) > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {(detailCustomer.documents ?? []).map((d, i)=> (
                      <li key={i}>
                        <a href={d.url.startsWith('http') ? d.url : `${apiBase}${d.url}`} target="_blank" rel="noopener noreferrer" className="text-[#0f766e] hover:underline">{d.name}</a>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-500">No documents uploaded.</p>}
                <div className="mt-2">
                  <label className="text-sm font-medium text-gray-700">Upload new (PDF, JPG)</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={uploadingDoc} onChange={(e) => handleDocumentUpload(e, detailCustomer.id)} className="mt-1 w-full text-sm text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded file:border-0 file:bg-gray-100" />
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Past invoices</h4>
                {detailInvoices.length === 0 ? (
                  <p className="text-sm text-gray-500">No invoices yet.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-left py-2 px-2">Invoice #</th>
                          <th className="text-right py-2 px-2">Amount</th>
                          <th className="text-left py-2 px-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailInvoices.map((inv) => (
                          <tr key={inv.id} className="border-t border-gray-100">
                            <td className="py-2 px-2">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '—'}</td>
                            <td className="py-2 px-2 font-mono">{inv.invoice_number}</td>
                            <td className="py-2 px-2 text-right">${(inv.total_amount || 0).toFixed(2)}</td>
                            <td className="py-2 px-2">
                              <span className={inv.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}>{(inv.payment_status || 'unpaid').toLowerCase()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button type="button" onClick={() => { openEdit(detailCustomer); setDetailCustomer(null); }} className="px-4 py-2 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#0d6b63]">
                  Edit customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReceivePaymentLightbox
        isOpen={receivePaymentOpen}
        onClose={() => { setReceivePaymentOpen(false); setReceivePaymentCustomerId(undefined); }}
        onRecorded={() => { fetchSummary(); fetchBalances(); fetchCustomers(); }}
        preselectedCustomerId={receivePaymentCustomerId}
      />
    </div>
  );
}
