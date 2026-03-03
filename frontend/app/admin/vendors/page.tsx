'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Search, Trash2, X, MapPin, FolderPlus } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';

interface Vendor {
  id: string;
  supplier_id?: string;
  name: string;
  contact_name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  payment_terms?: string;
  notes?: string;
  purchases?: number;
  payments?: number;
  balance?: number;
  open_balance?: number;
  paid_balance?: number;
}

const TEAL = '#0f766e';

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [form, setForm] = useState<Partial<Vendor>>({
    supplier_id: '',
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    payment_terms: '',
    notes: '',
  });

  const fetchVendors = async () => {
    try {
      const res = await adminApi.get('/vendors', { params: search ? { search } : {} });
      setVendors(res.data.vendors || []);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = async () => {
    try {
      const res = await adminApi.get('/vendors/locations/states');
      setStates(res.data.states || []);
    } catch {
      setStates(['Arizona', 'California', 'Florida', 'Texas']);
    }
  };

  const fetchCities = async (state?: string) => {
    try {
      const res = await adminApi.get('/vendors/locations/cities', { params: state ? { state } : {} });
      setCities(res.data.cities || []);
    } catch {
      setCities([]);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [search]);

  useEffect(() => {
    if (showModal) {
      fetchStates();
      fetchCities(form.state);
    }
  }, [showModal, form.state]);

  const generateId = async () => {
    try {
      const res = await adminApi.get('/vendors/generate-id');
      setForm((f) => ({ ...f, supplier_id: res.data.supplier_id }));
    } catch {
      setForm((f) => ({ ...f, supplier_id: 'S' + Math.floor(10000 + Math.random() * 90000) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast.error('Supplier name is required');
      return;
    }
    try {
      if (editing) {
        await adminApi.put(`/vendors/${editing.id}`, form);
        toast.success('Supplier updated');
      } else {
        await adminApi.post('/vendors', form);
        toast.success('Supplier created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ supplier_id: '', name: '', contact_name: '', phone: '', email: '', address: '', city: '', state: '', zip: '', payment_terms: '', notes: '' });
      fetchVendors();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      supplier_id: v.supplier_id,
      name: v.name,
      contact_name: v.contact_name,
      phone: v.phone,
      email: v.email,
      address: v.address,
      city: v.city,
      state: v.state,
      zip: v.zip,
      payment_terms: v.payment_terms,
      notes: v.notes,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this supplier?')) return;
    try {
      await adminApi.delete(`/vendors/${id}`);
      toast.success('Supplier deactivated');
      fetchVendors();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const totalPurchases = vendors.reduce((s, v) => s + (v.purchases ?? 0), 0);
  const totalOpen = vendors.reduce((s, v) => s + (v.open_balance ?? v.balance ?? 0), 0);
  const totalPaid = vendors.reduce((s, v) => s + (v.paid_balance ?? v.payments ?? 0), 0);
  const suppliersWithBalance = vendors.filter((v) => (v.open_balance ?? v.balance ?? 0) > 0).length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Unbilled & purchases</p>
          <p className="text-2xl font-bold text-gray-900">${totalPurchases.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Total purchase orders with this supplier list.</p>
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Open payables</p>
          <p className="text-2xl font-bold text-amber-700">${totalOpen.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{suppliersWithBalance} supplier(s) with outstanding balance.</p>
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Amount paid (lifetime)</p>
          <p className="text-2xl font-bold text-emerald-700">${totalPaid.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Based on purchase orders minus open balance.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mt-6 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers by name, company, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm({ supplier_id: '', name: '', contact_name: '', phone: '', email: '', address: '', city: '', state: '', zip: '', payment_terms: '', notes: '' });
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium bg-[#0f766e] hover:bg-[#0d5d57]"
          >
            <Plus className="w-4 h-4" />
            New Supplier
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
                  <th className="text-left py-3 px-4 text-sm font-medium">Supplier ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Supplier name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium">Company</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Open balance</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Paid</th>
                  <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-gray-500">
                      No suppliers yet. Click &quot;New Supplier&quot; to add one.
                    </td>
                  </tr>
                ) : (
                  vendors.map((v, i) => (
                    <tr
                      key={v.id}
                      className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-teal-50 cursor-pointer`}
                      onClick={() => router.push(`/admin/vendors/${v.id}`)}
                    >
                      <td className="py-2 px-4 text-sm">{v.supplier_id || '—'}</td>
                      <td className="py-2 px-4 text-sm font-medium text-gray-900">{v.contact_name || v.name}</td>
                      <td className="py-2 px-4 text-sm text-gray-700">{v.name}</td>
                      <td className="py-2 px-4 text-sm text-right">${Number(v.open_balance ?? v.balance ?? 0).toFixed(2)}</td>
                      <td className="py-2 px-4 text-sm text-right">${Number(v.paid_balance ?? v.payments ?? 0).toFixed(2)}</td>
                      <td className="py-2 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(v);
                          }}
                          className="text-[#0f766e] hover:underline text-sm font-medium mr-2"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(v.id);
                          }}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">{editing ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID *</label>
                  <input
                    type="text"
                    value={form.supplier_id || ''}
                    onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div className="pt-7">
                  <button
                    type="button"
                    onClick={generateId}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-[#0f766e] text-[#0f766e] bg-white hover:bg-teal-50"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name *</label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <input
                  type="text"
                  value={form.phone || ''}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="e.g. (480) 555-0592"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <select
                  value={form.state || ''}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, state: e.target.value, city: '' }));
                    fetchCities(e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select state</option>
                  {states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <select
                  value={form.city || ''}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {cities.length === 0 && (
                  <input
                    type="text"
                    value={form.city || ''}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Or type city"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={form.address || ''}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  Close
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-white font-medium bg-[#0f766e] hover:bg-[#0d5d57]">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}