'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, X, Wallet, TrendingUp, Tag, Award, Search } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';

interface Expense {
  id: string;
  expense_number: string;
  date: string;
  expense_type: string;
  description?: string;
  amount: number;
  payment_mode: string;
  vendor_name?: string;
  attachment?: string;
  is_recurring: boolean;
  recurrence_type: string;
  created_at: string;
}

// Payment modes now come from Catalog → Payment methods

export default function ExpensesPage() {
  const [summary, setSummary] = useState<{
    total: number;
    fixed: number;
    variable: number;
    highestCategory?: { name: string; amount: number };
  }>({ total: 0, fixed: 0, variable: 0 });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    expense_type: '',
    description: '',
    amount: '',
    payment_mode: 'CASH',
    vendor_name: '',
    attachment: '',
    is_recurring: false,
    recurrence_type: 'NONE' as string,
  });
  const [filters, setFilters] = useState({ start: '', end: '', expense_type: '', payment_mode: '' });
  const [submitting, setSubmitting] = useState(false);
  const [paymentModes, setPaymentModes] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const thisMonthStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const thisMonthEnd = () => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  };

  const fetchSummary = async () => {
    try {
      const start = filters.start || thisMonthStart();
      const end = filters.end || thisMonthEnd();
      const res = await adminApi.get('/expenses/summary', { params: { start, end } });
      setSummary(res.data);
    } catch {
      setSummary({ total: 0, fixed: 0, variable: 0 });
    }
  };

  const fetchExpenses = async () => {
    try {
      const params: any = { page: 1, limit: 100 };
      if (filters.start) params.start = filters.start;
      if (filters.end) params.end = filters.end;
      if (filters.expense_type) params.expense_type = filters.expense_type;
      if (filters.payment_mode) params.payment_mode = filters.payment_mode;
      const res = await adminApi.get('/expenses', { params });
      setExpenses(res.data.expenses || []);
    } catch {
      setExpenses([]);
    }
  };

  const fetchPaymentModes = async () => {
    try {
      const res = await adminApi.get('/payment-methods');
      const list = Array.isArray(res.data) ? res.data : [];
      setPaymentModes(list.map((p: any) => p.name));
    } catch {
      setPaymentModes([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchSummary(), fetchExpenses(), fetchPaymentModes()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchExpenses();
  }, [filters.start, filters.end, filters.expense_type, filters.payment_mode]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      expense_type: '',
      description: '',
      amount: '',
      payment_mode: 'CASH',
      vendor_name: '',
      attachment: '',
      is_recurring: false,
      recurrence_type: 'NONE',
    });
    setShowModal(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({
      date: e.date?.toString().slice(0, 10) || new Date().toISOString().slice(0, 10),
      expense_type: e.expense_type || '',
      description: e.description || '',
      amount: String(e.amount ?? ''),
      payment_mode: e.payment_mode || 'CASH',
      vendor_name: e.vendor_name || '',
      attachment: e.attachment || '',
      is_recurring: e.is_recurring || false,
      recurrence_type: e.recurrence_type || 'NONE',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typeTrim = (form.expense_type || '').trim();
    if (!typeTrim) {
      toast.error('Enter expense type (e.g. Electricity, WiFi, Shipping, Transport)');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Enter amount');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        date: form.date,
        expense_type: typeTrim,
        description: form.description || undefined,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        vendor_name: form.vendor_name || undefined,
        attachment: form.attachment || undefined,
        is_recurring: form.is_recurring,
        recurrence_type: form.recurrence_type,
      };
      if (editing) {
        await adminApi.put(`/expenses/${editing.id}`, payload);
        toast.success('Expense updated');
      } else {
        await adminApi.post('/expenses', payload);
        toast.success('Expense added');
      }
      setShowModal(false);
      fetchSummary();
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense? (Soft delete)')) return;
    try {
      await adminApi.delete(`/expenses/${id}`);
      toast.success('Expense deleted');
      fetchSummary();
      fetchExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—');

  const filteredExpenses = expenses.filter((e) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      e.expense_number.toLowerCase().includes(term) ||
      e.expense_type.toLowerCase().includes(term) ||
      (e.description || '').toLowerCase().includes(term) ||
      (e.vendor_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
      <div className="bg-white rounded-xl shadow-md p-4 mt-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search expenses by number, type, vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
          />
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#0f766e] border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Top cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0f766e]/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-[#0f766e]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Expenses (This Month)</p>
                  <p className="text-xl font-bold text-gray-900">{Number(summary.total).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fixed Expenses</p>
                  <p className="text-xl font-bold text-gray-900">{Number(summary.fixed).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Variable Expenses</p>
                  <p className="text-xl font-bold text-gray-900">{Number(summary.variable).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Award className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Highest expense type</p>
                  <p className="text-lg font-bold text-gray-900">
                    {summary.highestCategory ? `${summary.highestCategory.name} (${Number(summary.highestCategory.amount).toLocaleString()})` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters + Add + Table */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input type="date" value={filters.start} onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={filters.end} onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input type="text" value={filters.expense_type} onChange={(e) => setFilters((f) => ({ ...f, expense_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40" placeholder="Filter by expense type" />
            <select value={filters.payment_mode} onChange={(e) => setFilters((f) => ({ ...f, payment_mode: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All payment modes</option>
              {paymentModes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button onClick={openAdd} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#0d5d57]">
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#0f766e] text-white">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium">Number</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">Expense type</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">Description</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium">Payment</th>
                    <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">No expenses. Click &quot;Add Expense&quot; to add one.</td>
                    </tr>
                  ) : (
                    filteredExpenses.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{e.expense_number}</td>
                        <td className="py-3 px-4 text-sm">{formatDate(e.date)}</td>
                        <td className="py-3 px-4 text-sm">{e.expense_type}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{e.description || '—'}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium">{Number(e.amount).toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm">{e.payment_mode}</td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => openEdit(e)} className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg mr-1" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(e.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense type *</label>
                <input type="text" value={form.expense_type} onChange={(e) => setForm((f) => ({ ...f, expense_type: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g. Electricity, WiFi, Shipping, Transport, Manpower" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input type="number" min={0} step={0.01} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment mode *</label>
                <select value={form.payment_mode} onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  {paymentModes.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor name</label>
                <input type="text" value={form.vendor_name} onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachment URL</label>
                <input type="url" value={form.attachment} onChange={(e) => setForm((f) => ({ ...f, attachment: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Receipt link" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm((f) => ({ ...f, is_recurring: e.target.checked }))} className="rounded border-gray-300 text-[#0f766e]" />
                  <span className="text-sm">Recurring</span>
                </label>
                {form.is_recurring && (
                  <select value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#0f766e] text-white py-2 rounded-lg font-medium hover:bg-[#0d5d57] disabled:opacity-50">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
