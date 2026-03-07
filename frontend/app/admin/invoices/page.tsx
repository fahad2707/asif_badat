'use client';

import { useEffect, useState } from 'react';
import { Search, Download, Mail, Plus, Edit2, Eye, DollarSign } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';
import InvoiceFormLightbox from '@/components/admin/InvoiceFormLightbox';
import ReceivePaymentLightbox from '@/components/admin/ReceivePaymentLightbox';

interface InvoiceItem {
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  total_amount: number;
  amount_paid?: number;
  payment_status: string;
  created_at: string;
  invoice_date?: string;
  items?: InvoiceItem[];
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [receivePaymentCustomerId, setReceivePaymentCustomerId] = useState<string | undefined>();
  const [receivePaymentInvoiceId, setReceivePaymentInvoiceId] = useState<string | undefined>();
  const [summary, setSummary] = useState<{ totalPaid: number; totalUnpaid: number } | null>(null);
  const [docTypeFilter, setDocTypeFilter] = useState<'all' | 'invoice' | 'quotation'>('all');
  const [createMode, setCreateMode] = useState<'invoice' | 'quotation'>('invoice');

  const fetchInvoices = async () => {
    try {
      const params: Record<string, string> = searchTerm ? { search: searchTerm } : {};
      if (docTypeFilter !== 'all') params.type = docTypeFilter;
      const response = await adminApi.get('/invoices', { params });
      const data = response.data;
      setInvoices(Array.isArray(data) ? data : (data.invoices || []));
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await adminApi.get('/invoices/summary');
      setSummary({ totalPaid: res.data.totalPaid ?? 0, totalUnpaid: res.data.totalUnpaid ?? 0 });
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchSummary();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => { fetchInvoices(); }, 500);
    return () => clearTimeout(debounce);
  }, [searchTerm, docTypeFilter]);

  const handleDownloadPDF = async (invoiceId: string) => {
    try {
      const response = await adminApi.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded');
    } catch (error) {
      toast.error('Failed to download invoice');
    }
  };

  const handleSendEmail = async (invoiceId: string) => {
    try {
      await adminApi.post(`/invoices/${invoiceId}/send-email`);
      toast.success('Invoice sent via email');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send email');
    }
  };

  const openReceivePayment = (inv: Invoice) => {
    setReceivePaymentCustomerId(inv.customer_id || undefined);
    setReceivePaymentInvoiceId(inv.id);
    setReceivePaymentOpen(true);
  };

  const statusDisplay = (inv: Invoice) => (inv.payment_status || 'unpaid').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid';
  const balance = (inv: Invoice) => (inv.total_amount ?? 0) - (inv.amount_paid ?? 0);
  const balanceLabel = (inv: Invoice) => {
    const b = balance(inv);
    if (b <= 0) return { text: 'Overpaid', value: Math.abs(b), className: 'text-blue-600' };
    return { text: 'Due', value: b, className: 'text-amber-700' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices & Quotations</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setCreateMode('invoice'); setEditId(null); setCreateOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f766e] text-white rounded-lg font-medium hover:bg-[#0d6b63]"
          >
            <Plus className="w-4 h-4" />
            Create invoice
          </button>
          <button
            type="button"
            onClick={() => { setCreateMode('quotation'); setEditId(null); setCreateOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#0f766e] text-[#0f766e] rounded-lg font-medium hover:bg-teal-50"
          >
            <Plus className="w-4 h-4" />
            Create quotation
          </button>
        </div>
      </div>

      {summary !== null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-1">Unpaid</p>
              <p className="text-2xl font-bold text-amber-700">${Number(summary.totalUnpaid).toFixed(2)}</p>
              <div className="mt-3 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all"
                  style={{ width: summary.totalUnpaid + summary.totalPaid > 0 ? `${(summary.totalUnpaid / (summary.totalUnpaid + summary.totalPaid)) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Total outstanding</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-1">Paid</p>
              <p className="text-2xl font-bold text-green-700">${Number(summary.totalPaid).toFixed(2)}</p>
              <div className="mt-3 h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: summary.totalUnpaid + summary.totalPaid > 0 ? `${(summary.totalPaid / (summary.totalUnpaid + summary.totalPaid)) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">Total received</p>
            </div>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by number, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-[#0f766e]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
          <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value as 'all' | 'invoice' | 'quotation')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">All</option>
            <option value="invoice">Invoices only</option>
            <option value="quotation">Quotations only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#0f766e] border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0f766e] text-white">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Number</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Customer</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Amount</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Paid</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Balance</th>
                <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : new Date(invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${(invoice.invoice_type || 'invoice') === 'quotation' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {(invoice.invoice_type || 'invoice') === 'quotation' ? 'Quotation' : 'Invoice'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-sm text-gray-900">{invoice.invoice_number}</td>
                  <td className="py-3 px-4">
                    <div>
                      {invoice.customer_name && <p className="font-medium text-gray-900">{invoice.customer_name}</p>}
                      {invoice.customer_phone && <p className="text-xs text-gray-600">{invoice.customer_phone}</p>}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    ${parseFloat(String(invoice.total_amount)).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">
                    ${parseFloat(String(invoice.amount_paid ?? 0)).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {(() => {
                      const bl = balanceLabel(invoice);
                      return (
                        <span className={`text-sm font-medium ${bl.className}`} title={bl.value === 0 ? 'Fully paid' : bl.text}>
                          {bl.value === 0 ? '—' : `${bl.text}: $${bl.value.toFixed(2)}`}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                        statusDisplay(invoice) === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {statusDisplay(invoice)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleDownloadPDF(invoice.id)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {invoice.customer_email && (
                        <button
                          onClick={() => handleSendEmail(invoice.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => { setEditId(invoice.id); setCreateOpen(true); }}
                        className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openReceivePayment(invoice)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Receive payment"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 && (
            <div className="py-12 text-center text-gray-500">No invoices or quotations yet. Create one to get started.</div>
          )}
        </div>
      )}

      <InvoiceFormLightbox
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditId(null); }}
        onSaved={() => { fetchInvoices(); fetchSummary(); }}
        editId={editId}
        initialDocumentType={createMode}
      />
      <ReceivePaymentLightbox
        isOpen={receivePaymentOpen}
        onClose={() => { setReceivePaymentOpen(false); setReceivePaymentCustomerId(undefined); setReceivePaymentInvoiceId(undefined); }}
        onRecorded={() => { fetchInvoices(); fetchSummary(); }}
        preselectedCustomerId={receivePaymentCustomerId}
        preselectedInvoiceId={receivePaymentInvoiceId}
      />
    </div>
  );
}
