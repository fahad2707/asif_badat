'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, Edit, ChevronDown, DollarSign, FileText, Upload, FileSignature, CheckCircle, AlertCircle } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';
import InvoiceFormLightbox from '@/components/admin/InvoiceFormLightbox';
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
  notes?: string;
  documents?: CustomerDoc[];
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date?: string;
  due_date?: string;
  total_amount: number;
  amount_paid?: number;
  payment_status: string;
  created_at: string;
}

interface ReceiptRow {
  id: string;
  trx_id: string;
  trx_date: string;
  amount_received: number;
  pmt_mode?: string;
  invoice_num?: string;
}

type TabId = 'transactions' | 'details';

export default function CustomerDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const newInvoice = searchParams?.get('newInvoice') === '1';
  const newCreditMemo = searchParams?.get('newCreditMemo') === '1';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('transactions');
  const [showNewTransactionDropdown, setShowNewTransactionDropdown] = useState(false);
  const [showEditDropdown, setShowEditDropdown] = useState(false);
  const [invoiceLightboxOpen, setInvoiceLightboxOpen] = useState(false);
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [receivePaymentInvoiceId, setReceivePaymentInvoiceId] = useState<string | undefined>();
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const apiBase = typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/?$/, '') : '';

  const fetchCustomer = async () => {
    if (!id) return;
    try {
      const r = await adminApi.get(`/customers/${id}`);
      setCustomer(r.data);
    } catch {
      toast.error('Customer not found');
    }
  };

  const fetchInvoices = async () => {
    if (!id) return;
    try {
      const r = await adminApi.get('/invoices', { params: { customer_id: id, limit: 200 } });
      const data = Array.isArray(r.data) ? r.data : (r.data.invoices || r.data);
      setInvoices(Array.isArray(data) ? data : []);
    } catch {
      setInvoices([]);
    }
  };

  const fetchReceipts = async () => {
    if (!id) return;
    try {
      const r = await adminApi.get('/receipts', { params: {} });
      const list = r.data?.receipts || [];
      setReceipts(list.filter((rec: ReceiptRow & { customer_id?: string }) => String(rec.customer_id) === String(id)));
    } catch {
      setReceipts([]);
    }
  };

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchCustomer(), fetchInvoices(), fetchReceipts()]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (newInvoice && customer) setInvoiceLightboxOpen(true);
  }, [newInvoice, customer]);

  const openBalance = invoices
    .filter((i) => (i.payment_status || '').toLowerCase() !== 'paid')
    .reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);

  const overdueAmount = invoices
    .filter((i) => (i.payment_status || '').toLowerCase() !== 'paid' && i.due_date && new Date(i.due_date) < new Date())
    .reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);

  const combinedTransactions = [
    ...invoices.map((inv) => ({
      id: inv.id,
      date: inv.invoice_date || inv.created_at,
      type: 'Invoice' as const,
      no: inv.invoice_number,
      customer: customer?.name || '',
      memo: '',
      amount: inv.total_amount,
      status: inv.payment_status,
      invoiceId: inv.id,
      amount_paid: inv.amount_paid,
      due_date: inv.due_date,
    })),
    ...receipts.map((rec) => ({
      id: rec.id,
      date: rec.trx_date,
      type: 'Payment' as const,
      no: rec.trx_id,
      customer: customer?.name || '',
      memo: '',
      amount: rec.amount_received,
      status: 'Closed' as const,
      invoiceId: null as string | null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await adminApi.post(`/customers/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded');
      fetchCustomer();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const getStatusDisplay = (row: (typeof combinedTransactions)[0]) => {
    if (row.type === 'Payment') return { text: 'Closed', className: 'text-green-600', icon: CheckCircle };
    const paid = (row.status || '').toLowerCase() === 'paid';
    const due = row.due_date && new Date(row.due_date) < new Date();
    if (paid) return { text: 'Paid', className: 'text-green-600', icon: CheckCircle };
    if (due) return { text: `Overdue on ${row.due_date ? new Date(row.due_date).toLocaleDateString() : ''}`, className: 'text-red-600', icon: AlertCircle };
    return { text: 'Open', className: 'text-amber-600', icon: AlertCircle };
  };

  if (loading || !customer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#0f766e] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin/customers" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium">
          <ChevronLeft className="w-5 h-5" /> Customers
        </Link>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button type="button" onClick={() => { setShowEditDropdown(!showEditDropdown); setShowNewTransactionDropdown(false); }} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
              Edit <ChevronDown className="w-4 h-4" />
            </button>
            {showEditDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEditDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
                  <Link href={`/admin/customers?edit=${id}`} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowEditDropdown(false)}>Edit customer</Link>
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowNewTransactionDropdown(!showNewTransactionDropdown); setShowEditDropdown(false); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#0d6b63]"
            >
              New transaction <ChevronDown className="w-4 h-4" />
            </button>
            {showNewTransactionDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNewTransactionDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[180px]">
                  <button type="button" onClick={() => { setInvoiceLightboxOpen(true); setShowNewTransactionDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Invoice
                  </button>
                  <Link href={`/admin/credit-memos?new=1&customer_id=${id}`} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <FileSignature className="w-4 h-4" /> Credit memo
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Customer header card */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0f766e]/10 flex items-center justify-center text-xl font-bold text-[#0f766e] shrink-0">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              {customer.customer_code && <p className="text-sm text-gray-500">ID: {customer.customer_code}</p>}
              <div className="flex gap-2 mt-2">
                <span className="p-1.5 rounded bg-gray-100 text-gray-600" title="Documents"><FileText className="w-4 h-4" /></span>
                <span className="p-1.5 rounded bg-gray-100 text-gray-600" title="Upload"><Upload className="w-4 h-4" /></span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-[240px] grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500 block">Email</span>{customer.email || <span className="text-gray-400">Add email</span>}</div>
            <div><span className="text-gray-500 block">Phone</span>{customer.phone || <span className="text-gray-400">Add phone number</span>}</div>
            <div className="sm:col-span-2"><span className="text-gray-500 block">Billing address</span>{[customer.billing_address || customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || '—'}</div>
            <div className="sm:col-span-2"><span className="text-gray-500 block">Shipping address</span>{(customer.billing_address || customer.address) ? '(same as billing address)' : '—'}</div>
            <div><span className="text-gray-500 block">Notes</span>{customer.notes || <span className="text-gray-400">Add notes</span>}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 min-w-[200px] border border-blue-100">
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4" /> Financial summary</p>
            <p className="text-sm text-gray-600">Open balance <span className="font-bold text-amber-700">${openBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></p>
            <p className="text-sm text-gray-600 mt-1">Overdue payment <span className="font-bold text-red-700">${overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></p>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl shadow border border-gray-200 p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">Documents</h3>
        {(customer.documents?.length ?? 0) > 0 ? (
          <ul className="space-y-1 text-sm mb-3">
            {(customer.documents ?? []).map((d, i) => (
              <li key={i}>
                <a href={d.url.startsWith('http') ? d.url : `${apiBase}${d.url}`} target="_blank" rel="noopener noreferrer" className="text-[#0f766e] hover:underline">{d.name}</a>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500 mb-3">No documents uploaded.</p>}
        <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium cursor-pointer">
          <Upload className="w-4 h-4" />
          {uploadingDoc ? 'Uploading…' : 'Upload document'}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploadingDoc} onChange={handleDocumentUpload} />
        </label>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <button type="button" onClick={() => setActiveTab('transactions')} className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'transactions' ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          Transaction List
        </button>
        <button type="button" onClick={() => setActiveTab('details')} className={`px-4 py-2 font-medium border-b-2 -mb-px ml-2 ${activeTab === 'details' ? 'border-[#0f766e] text-[#0f766e]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
          Customer Details
        </button>
      </div>

      {activeTab === 'transactions' && (
        <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 py-2 px-2" />
                  <th className="text-left py-2 px-2 font-medium text-gray-700">DATE</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">TYPE</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">NO.</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">CUSTOMER</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">MEMO</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">AMOUNT</th>
                  <th className="text-left py-2 px-2 font-medium text-gray-700">STATUS</th>
                  <th className="text-right py-2 px-2 font-medium text-gray-700">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {combinedTransactions.map((row) => {
                  const status = getStatusDisplay(row);
                  const Icon = status.icon;
                  return (
                    <tr key={`${row.type}-${row.id}`} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2"><input type="checkbox" className="rounded border-gray-300" /></td>
                      <td className="py-2 px-2 text-gray-700">{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                      <td className="py-2 px-2 font-medium">{row.type}</td>
                      <td className="py-2 px-2 font-mono">{row.no}</td>
                      <td className="py-2 px-2 text-gray-700">{row.customer}</td>
                      <td className="py-2 px-2 text-gray-500">{row.memo || '—'}</td>
                      <td className="py-2 px-2 text-right font-medium">${Number(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-2">
                        <span className={`inline-flex items-center gap-1 ${status.className}`}>
                          <Icon className="w-4 h-4 shrink-0" />
                          {status.text}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        {row.type === 'Invoice' && (
                          <>
                            <Link href={`/admin/invoices?edit=${row.id}`} className="text-[#0f766e] hover:underline mr-2">View/Edit</Link>
                            {(row.status || '').toLowerCase() !== 'paid' && (
                              <button type="button" onClick={() => { setReceivePaymentInvoiceId(row.id); setReceivePaymentOpen(true); }} className="px-2 py-1 bg-[#0f766e] text-white rounded text-xs font-medium hover:bg-[#0d6b63]">
                                Receive payment
                              </button>
                            )}
                            {(row.status || '').toLowerCase() === 'paid' && (
                              <button type="button" className="px-2 py-1 border border-gray-300 rounded text-xs font-medium hover:bg-gray-50">Print</button>
                            )}
                          </>
                        )}
                        {row.type === 'Payment' && <Link href="/admin/receipts" className="text-[#0f766e] hover:underline">View/Edit</Link>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {combinedTransactions.length === 0 && <p className="text-center py-8 text-gray-500">No transactions yet.</p>}
        </div>
      )}

      {activeTab === 'details' && (
        <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div><span className="text-gray-500 block mb-1">Name</span><span className="font-medium">{customer.name}</span></div>
            <div><span className="text-gray-500 block mb-1">Company</span>{customer.company || '—'}</div>
            <div><span className="text-gray-500 block mb-1">Phone</span>{customer.phone}</div>
            <div><span className="text-gray-500 block mb-1">Email</span>{customer.email || '—'}</div>
            <div className="md:col-span-2"><span className="text-gray-500 block mb-1">Billing address</span>{[customer.billing_address || customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || '—'}</div>
            <div><span className="text-gray-500 block mb-1">Payment terms</span>{customer.payment_terms || '—'}</div>
            <div className="md:col-span-2"><span className="text-gray-500 block mb-1">Notes</span>{customer.notes || '—'}</div>
          </div>
        </div>
      )}

      <InvoiceFormLightbox
        isOpen={invoiceLightboxOpen}
        onClose={() => setInvoiceLightboxOpen(false)}
        onSaved={() => { fetchInvoices(); setInvoiceLightboxOpen(false); }}
        initialCustomerId={id}
      />
      <ReceivePaymentLightbox
        isOpen={receivePaymentOpen}
        onClose={() => { setReceivePaymentOpen(false); setReceivePaymentInvoiceId(undefined); }}
        onRecorded={() => { fetchInvoices(); fetchCustomer(); }}
        preselectedCustomerId={id}
        preselectedInvoiceId={receivePaymentInvoiceId}
      />
    </div>
  );
}
