'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, UploadCloud } from 'lucide-react';
import adminApi, { uploadApi } from '@/lib/admin-api';
import toast from 'react-hot-toast';

interface Supplier {
  id: string;
  supplier_id?: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  tax_id?: string;
  gst_number?: string;
  payment_terms?: string;
  payment_terms_days?: number;
  credit_limit?: number;
  rating?: number;
  status?: string;
  notes?: string;
  bank_details?: {
    account_name?: string;
    account_number?: string;
    bank_name?: string;
    ifsc?: string;
    branch?: string;
  };
  documents?: { name: string; url: string; uploaded_at?: string }[];
}

interface LedgerEntry {
  id: string;
  date: string;
  reference_type: string;
  reference_id?: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'details' | 'documents'>('transactions');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendorRes, balanceRes, ledgerRes] = await Promise.all([
        adminApi.get(`/vendors/${id}`),
        adminApi.get(`/vendors/${id}/balance`),
        adminApi.get(`/vendors/${id}/ledger`, { params: { limit: 100 } }),
      ]);
      setSupplier(vendorRes.data);
      setBalance(balanceRes.data?.balance ?? null);
      setLedger((ledgerRes.data?.entries || []) as LedgerEntry[]);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load supplier');
      router.push('/admin/vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUploadDocuments = async (files: FileList | null) => {
    if (!files || !supplier) return;
    setUploading(true);
    try {
      const docs: Supplier['documents'] = supplier.documents ? [...supplier.documents] : [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const form = new FormData();
        form.append('file', file);
        const res = await uploadApi.post(`/vendors/${supplier.id}/documents`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        docs.push(...(res.data.documents || []));
      }
      setSupplier((prev) => (prev ? { ...prev, documents: docs } : prev));
      toast.success('Document(s) uploaded');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to upload documents');
    } finally {
      setUploading(false);
    }
  };

  if (loading || !supplier) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#0f766e] border-t-transparent" />
      </div>
    );
  }

  const openBalance = balance ?? 0;

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/vendors" className="inline-flex items-center gap-2 text-[#0f766e] hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to suppliers
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            Supplier ID: <span className="font-mono">{supplier.supplier_id || '—'}</span>
          </p>
          {supplier.contact_name && (
            <p className="text-sm text-gray-600">
              Contact: {supplier.contact_name} {supplier.phone ? `• ${supplier.phone}` : ''}
            </p>
          )}
          {supplier.email && (
            <p className="text-sm text-gray-600">
              Email: <a href={`mailto:${supplier.email}`} className="text-[#0f766e] hover:underline">{supplier.email}</a>
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl shadow border border-gray-200 px-4 py-3 min-w-[220px]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open balance</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">${openBalance.toFixed(2)}</p>
          {supplier.credit_limit != null && (
            <p className="text-xs text-gray-500 mt-1">
              Credit limit: ${supplier.credit_limit.toFixed(2)}
            </p>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`pb-2 text-sm font-medium border-b-2 ${
              activeTab === 'transactions' ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Transactions
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`pb-2 text-sm font-medium border-b-2 ${
              activeTab === 'details' ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Supplier details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`pb-2 text-sm font-medium border-b-2 ${
              activeTab === 'documents' ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Documents
          </button>
        </nav>
      </div>

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-800">Transaction list</span>
            </div>
            <span className="text-xs text-gray-500">Last {ledger.length} entries</span>
          </div>
          {ledger.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">No activity yet for this supplier.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-right py-2 px-3">Debit</th>
                    <th className="text-right py-2 px-3">Credit</th>
                    <th className="text-right py-2 px-3">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e, idx) => (
                    <tr key={e.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="py-2 px-3">{e.date ? new Date(e.date).toLocaleDateString() : '—'}</td>
                      <td className="py-2 px-3 text-xs font-medium text-gray-700">{e.reference_type || 'Entry'}</td>
                      <td className="py-2 px-3 text-gray-700">{e.description || '—'}</td>
                      <td className="py-2 px-3 text-right">${Number(e.debit || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">${Number(e.credit || 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">${Number(e.balance || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'details' && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Contact</h3>
              <p className="text-sm text-gray-700">{supplier.contact_name || '—'}</p>
              <p className="text-sm text-gray-700">{supplier.phone || '—'}</p>
              <p className="text-sm text-gray-700">{supplier.email || '—'}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Address</h3>
              <p className="text-sm text-gray-700">
                {supplier.address || '—'}
                {supplier.city ? `, ${supplier.city}` : ''}
                {supplier.state ? `, ${supplier.state}` : ''}
                {supplier.zip ? `, ${supplier.zip}` : ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Terms & rating</h3>
              <p className="text-sm text-gray-700">
                Payment terms: {supplier.payment_terms || (supplier.payment_terms_days ? `Net ${supplier.payment_terms_days}` : '—')}
              </p>
              <p className="text-sm text-gray-700">
                Rating: {supplier.rating != null ? `${supplier.rating}/100` : '—'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Tax IDs</h3>
              <p className="text-sm text-gray-700">Tax ID: {supplier.tax_id || '—'}</p>
              <p className="text-sm text-gray-700">GST: {supplier.gst_number || '—'}</p>
            </div>
          </div>
          {supplier.notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{supplier.notes}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-800">Supplier documents</span>
            </div>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
              <UploadCloud className="w-4 h-4" />
              <span>{uploading ? 'Uploading…' : 'Upload files'}</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleUploadDocuments(e.target.files)}
              />
            </label>
          </div>
          {(!supplier.documents || supplier.documents.length === 0) ? (
            <p className="text-sm text-gray-500">No documents yet. Upload PDFs, images, or other files related to this supplier.</p>
          ) : (
            <ul className="divide-y divide-gray-200 text-sm">
              {supplier.documents.map((d, idx) => (
                <li key={`${d.url}-${idx}`} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="text-gray-800">{d.name}</p>
                    <p className="text-xs text-gray-500">
                      {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0f766e] hover:underline text-xs font-medium"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

