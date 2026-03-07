'use client';

import { useEffect, useState, useCallback } from 'react';
import { FolderTree, Layers, Percent, CreditCard, Landmark, Plus, Edit, Trash2, X, FileDown, Package, ImagePlus } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';

type TabId = 'categories' | 'subcategories' | 'tax' | 'payment' | 'bank';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  display_order?: number;
}

interface SubCategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  category_name?: string;
  display_order?: number;
}

interface TaxType {
  id: string;
  name: string;
  rate: number;
  rate_type?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  display_order?: number;
}

interface BankAccount {
  id: string;
  name: string;
  account_number?: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  category_id?: string;
  sub_category_id?: string;
}

const TABS: { id: TabId; label: string; icon: typeof FolderTree }[] = [
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'subcategories', label: 'Subcategories', icon: Layers },
  { id: 'tax', label: 'Tax types', icon: Percent },
  { id: 'payment', label: 'Payment methods', icon: CreditCard },
  { id: 'bank', label: 'Bank accounts', icon: Landmark },
];

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<TabId>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ type: TabId; edit?: any } | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  // Multi-select for bulk delete / export
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Set<string>>(new Set());
  const [selectedTaxIds, setSelectedTaxIds] = useState<Set<string>>(new Set());
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());

  // Single selection to show products panel
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [productsInCategory, setProductsInCategory] = useState<Product[]>([]);
  const [productsInSubcategory, setProductsInSubcategory] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [addProductId, setAddProductId] = useState<string>('');
  const [addProductIdSub, setAddProductIdSub] = useState<string>('');

  const fetchCategories = async () => {
    try {
      const res = await adminApi.get('/categories');
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCategories([]);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const res = await adminApi.get('/sub-categories');
      setSubcategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSubcategories([]);
    }
  };

  const fetchTaxTypes = async () => {
    try {
      const res = await adminApi.get('/tax-types');
      setTaxTypes(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTaxTypes([]);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await adminApi.get('/payment-methods');
      setPaymentMethods(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPaymentMethods([]);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const res = await adminApi.get('/bank-accounts/admin');
      setBankAccounts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setBankAccounts([]);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchSubcategories(), fetchTaxTypes(), fetchPaymentMethods(), fetchBankAccounts()]);
    setLoading(false);
  }, []);

  const fetchProductsByCategory = useCallback(async (categoryId: string) => {
    setProductsLoading(true);
    try {
      const res = await adminApi.get('/products', { params: { category_id: categoryId, limit: 500 } });
      setProductsInCategory(res.data?.products || []);
    } catch {
      setProductsInCategory([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchProductsBySubcategory = useCallback(async (subcategoryId: string) => {
    setProductsLoading(true);
    try {
      const res = await adminApi.get('/products', { params: { sub_category_id: subcategoryId, limit: 500 } });
      setProductsInSubcategory(res.data?.products || []);
    } catch {
      setProductsInSubcategory([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchAllProducts = useCallback(async () => {
    try {
      const res = await adminApi.get('/products', { params: { limit: 2000 } });
      setAllProducts(res.data?.products || []);
    } catch {
      setAllProducts([]);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (selectedCategoryId) {
      fetchProductsByCategory(selectedCategoryId);
      fetchAllProducts();
    } else {
      setProductsInCategory([]);
    }
  }, [selectedCategoryId, fetchProductsByCategory, fetchAllProducts]);

  useEffect(() => {
    if (selectedSubcategoryId) {
      fetchProductsBySubcategory(selectedSubcategoryId);
      fetchAllProducts();
    } else {
      setProductsInSubcategory([]);
    }
  }, [selectedSubcategoryId, fetchProductsBySubcategory, fetchAllProducts]);

  const openAdd = (type: TabId) => {
    if (type === 'categories') setForm({ name: '', description: '', image_url: '', display_order: 0 });
    if (type === 'subcategories') setForm({ name: '', category_id: categories[0]?.id || '', display_order: 0 });
    if (type === 'tax') setForm({ name: '', rate: 0, rate_type: 'percent' });
    if (type === 'payment') setForm({ name: '', display_order: 0 });
    if (type === 'bank') setForm({ name: '', account_number: '' });
    setModal({ type });
  };

  const openEdit = (type: TabId, row: any) => {
    setForm({ ...row });
    setModal({ type, edit: row });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    const { type, edit } = modal;
    try {
      if (type === 'categories') {
        const catPayload = { name: form.name, description: form.description, image_url: form.image_url || '', display_order: form.display_order };
        if (edit) await adminApi.put(`/categories/${edit.id}`, catPayload);
        else await adminApi.post('/categories', { ...catPayload, display_order: form.display_order ?? 0 });
      }
      if (type === 'subcategories') {
        if (edit) await adminApi.put(`/sub-categories/${edit.id}`, { name: form.name, category_id: form.category_id, display_order: form.display_order });
        else await adminApi.post('/sub-categories', { name: form.name, category_id: form.category_id, display_order: form.display_order ?? 0 });
      }
      if (type === 'tax') {
        if (edit) await adminApi.put(`/tax-types/${edit.id}`, { name: form.name, rate: form.rate, rate_type: form.rate_type || 'percent' });
        else await adminApi.post('/tax-types', { name: form.name, rate: form.rate, rate_type: form.rate_type || 'percent' });
      }
      if (type === 'payment') {
        if (edit) await adminApi.put(`/payment-methods/${edit.id}`, { name: form.name, display_order: form.display_order });
        else await adminApi.post('/payment-methods', { name: form.name, display_order: form.display_order ?? 0 });
      }
      if (type === 'bank') {
        if (edit) await adminApi.put(`/bank-accounts/${edit.id}`, { name: form.name, account_number: form.account_number });
        else await adminApi.post('/bank-accounts', { name: form.name, account_number: form.account_number || undefined });
      }
      toast.success(edit ? 'Updated' : 'Created');
      setModal(null);
      fetchAll();
      if (selectedCategoryId) fetchProductsByCategory(selectedCategoryId);
      if (selectedSubcategoryId) fetchProductsBySubcategory(selectedSubcategoryId);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (type: TabId, id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      if (type === 'categories') await adminApi.delete(`/categories/${id}`);
      if (type === 'subcategories') await adminApi.delete(`/sub-categories/${id}`);
      if (type === 'tax') await adminApi.delete(`/tax-types/${id}`);
      if (type === 'payment') await adminApi.delete(`/payment-methods/${id}`);
      if (type === 'bank') await adminApi.delete(`/bank-accounts/${id}`);
      toast.success('Deleted');
      fetchAll();
      if (type === 'categories' && selectedCategoryId === id) setSelectedCategoryId(null);
      if (type === 'subcategories' && selectedSubcategoryId === id) setSelectedSubcategoryId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const toggleCategorySelect = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubcategorySelect = (id: string) => {
    setSelectedSubcategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTaxSelect = (id: string) => {
    setSelectedTaxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCategories = () => {
    if (selectedCategoryIds.size === categories.length) setSelectedCategoryIds(new Set());
    else setSelectedCategoryIds(new Set(categories.map((c) => c.id)));
  };

  const selectAllSubcategories = () => {
    if (selectedSubcategoryIds.size === subcategories.length) setSelectedSubcategoryIds(new Set());
    else setSelectedSubcategoryIds(new Set(subcategories.map((s) => s.id)));
  };

  const selectAllTax = () => {
    if (selectedTaxIds.size === taxTypes.length) setSelectedTaxIds(new Set());
    else setSelectedTaxIds(new Set(taxTypes.map((t) => t.id)));
  };

  const togglePaymentSelect = (id: string) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPayment = () => {
    if (selectedPaymentIds.size === paymentMethods.length) setSelectedPaymentIds(new Set());
    else setSelectedPaymentIds(new Set(paymentMethods.map((p) => p.id)));
  };

  const toggleBankSelect = (id: string) => {
    setSelectedBankIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBank = () => {
    if (selectedBankIds.size === bankAccounts.length) setSelectedBankIds(new Set());
    else setSelectedBankIds(new Set(bankAccounts.map((b) => b.id)));
  };

  const handleBulkDeleteCategories = async () => {
    if (selectedCategoryIds.size === 0) {
      toast.error('Select at least one category');
      return;
    }
    if (!confirm(`Delete ${selectedCategoryIds.size} selected category(ies)? Products in these categories will be unassigned.`)) return;
    try {
      await adminApi.post('/categories/bulk-delete', { ids: Array.from(selectedCategoryIds) });
      toast.success('Categories deleted');
      setSelectedCategoryIds(new Set());
      if (selectedCategoryId && selectedCategoryIds.has(selectedCategoryId)) setSelectedCategoryId(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleBulkDeleteSubcategories = async () => {
    if (selectedSubcategoryIds.size === 0) {
      toast.error('Select at least one subcategory');
      return;
    }
    if (!confirm(`Delete ${selectedSubcategoryIds.size} selected subcategory(ies)?`)) return;
    try {
      await adminApi.post('/sub-categories/bulk-delete', { ids: Array.from(selectedSubcategoryIds) });
      toast.success('Subcategories deleted');
      setSelectedSubcategoryIds(new Set());
      if (selectedSubcategoryId && selectedSubcategoryIds.has(selectedSubcategoryId)) setSelectedSubcategoryId(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleBulkDeleteTax = async () => {
    if (selectedTaxIds.size === 0) {
      toast.error('Select at least one tax type');
      return;
    }
    if (!confirm(`Delete ${selectedTaxIds.size} selected tax type(s)?`)) return;
    try {
      for (const id of selectedTaxIds) await adminApi.delete(`/tax-types/${id}`);
      toast.success('Tax types deleted');
      setSelectedTaxIds(new Set());
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleExportCategoriesCSV = () => {
    const toExport = selectedCategoryIds.size > 0 ? categories.filter((c) => selectedCategoryIds.has(c.id)) : categories;
    const rows = [['Name', 'Slug', 'Description', 'Display order'], ...toExport.map((c) => [c.name, c.slug, c.description || '', String(c.display_order ?? 0)])];
    downloadCSV(`categories-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const handleExportSubcategoriesCSV = () => {
    const toExport = selectedSubcategoryIds.size > 0 ? subcategories.filter((s) => selectedSubcategoryIds.has(s.id)) : subcategories;
    const rows = [['Name', 'Slug', 'Category', 'Display order'], ...toExport.map((s) => [s.name, s.slug, s.category_name || s.category_id || '', String(s.display_order ?? 0)])];
    downloadCSV(`subcategories-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const handleExportTaxCSV = () => {
    const toExport = selectedTaxIds.size > 0 ? taxTypes.filter((t) => selectedTaxIds.has(t.id)) : taxTypes;
    const rows = [['Name', 'Rate type', 'Rate'], ...toExport.map((t) => [t.name, t.rate_type === 'amount' ? 'USD' : '%', String(t.rate)])];
    downloadCSV(`tax-types-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const handleBulkDeletePayment = async () => {
    if (selectedPaymentIds.size === 0) {
      toast.error('Select at least one payment method');
      return;
    }
    if (!confirm(`Delete ${selectedPaymentIds.size} selected payment method(s)?`)) return;
    try {
      for (const id of selectedPaymentIds) await adminApi.delete(`/payment-methods/${id}`);
      toast.success('Payment methods deleted');
      setSelectedPaymentIds(new Set());
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleExportPaymentCSV = () => {
    const toExport = selectedPaymentIds.size > 0 ? paymentMethods.filter((p) => selectedPaymentIds.has(p.id)) : paymentMethods;
    const rows = [['Name', 'Display order'], ...toExport.map((p) => [p.name, String(p.display_order ?? 0)])];
    downloadCSV(`payment-methods-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const handleBulkDeleteBank = async () => {
    if (selectedBankIds.size === 0) {
      toast.error('Select at least one bank account');
      return;
    }
    if (!confirm(`Delete ${selectedBankIds.size} selected bank account(s)?`)) return;
    try {
      for (const id of selectedBankIds) await adminApi.delete(`/bank-accounts/${id}`);
      toast.success('Bank accounts deleted');
      setSelectedBankIds(new Set());
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleExportBankCSV = () => {
    const toExport = selectedBankIds.size > 0 ? bankAccounts.filter((b) => selectedBankIds.has(b.id)) : bankAccounts;
    const rows = [['Name', 'Account number'], ...toExport.map((b) => [b.name, b.account_number || ''])];
    downloadCSV(`bank-accounts-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const removeProductFromCategory = async (productId: string) => {
    try {
      await adminApi.put(`/products/${productId}`, { category_id: null, sub_category_id: null });
      toast.success('Product removed from category');
      if (selectedCategoryId) fetchProductsByCategory(selectedCategoryId);
      fetchAllProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const addProductToCategory = async () => {
    if (!selectedCategoryId || !addProductId) return;
    try {
      await adminApi.put(`/products/${addProductId}`, { category_id: selectedCategoryId, sub_category_id: null });
      toast.success('Product added to category');
      setAddProductId('');
      fetchProductsByCategory(selectedCategoryId);
      fetchAllProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const removeProductFromSubcategory = async (productId: string) => {
    try {
      await adminApi.put(`/products/${productId}`, { sub_category_id: null });
      toast.success('Product removed from subcategory');
      if (selectedSubcategoryId) fetchProductsBySubcategory(selectedSubcategoryId);
      fetchAllProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const addProductToSubcategory = async () => {
    if (!selectedSubcategoryId || !addProductIdSub) return;
    try {
      const sub = subcategories.find((s) => s.id === selectedSubcategoryId);
      await adminApi.put(`/products/${addProductIdSub}`, { sub_category_id: selectedSubcategoryId, category_id: sub?.category_id || undefined });
      toast.success('Product added to subcategory');
      setAddProductIdSub('');
      fetchProductsBySubcategory(selectedSubcategoryId);
      fetchAllProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const productsNotInCategory = allProducts.filter((p) => p.category_id !== selectedCategoryId);
  const productsNotInSubcategory = allProducts.filter((p) => p.sub_category_id !== selectedSubcategoryId);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Categories, Subcategories & Tax Types</h1>
      <p className="text-gray-600 mt-1">Manage your catalog structure, tax rates, and assign products to categories or subcategories.</p>

      <div className="flex flex-wrap gap-2 mt-6 border-b border-gray-200 pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                activeTab === tab.id ? 'bg-[#0f766e] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#0f766e] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mt-6 bg-white rounded-xl shadow overflow-hidden border border-gray-200">
            {activeTab === 'categories' && (
              <div className="p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Categories</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openAdd('categories')} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#0d5d57]">
                      <Plus className="w-4 h-4" /> Add category
                    </button>
                    <button onClick={handleBulkDeleteCategories} disabled={selectedCategoryIds.size === 0} className="px-4 py-2 rounded-lg font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Delete selected ({selectedCategoryIds.size})
                    </button>
                    <button onClick={handleExportCategoriesCSV} className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                      <FileDown className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 py-3 px-4">
                          <input type="checkbox" checked={categories.length > 0 && selectedCategoryIds.size === categories.length} onChange={selectAllCategories} className="rounded border-gray-300 text-[#0f766e]" />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Slug</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr
                          key={c.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedCategoryId === c.id ? 'bg-teal-50' : ''}`}
                          onClick={() => setSelectedCategoryId(selectedCategoryId === c.id ? null : c.id)}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedCategoryIds.has(c.id)} onChange={() => toggleCategorySelect(c.id)} className="rounded border-gray-300 text-[#0f766e]" />
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{c.name}</td>
                          <td className="py-3 px-4 text-gray-600">{c.slug}</td>
                          <td className="py-3 px-4 text-gray-600">{c.description || '—'}</td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openEdit('categories', c)} className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg mr-1" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete('categories', c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {categories.length === 0 && <p className="text-center py-8 text-gray-500">No categories yet. Click &quot;Add category&quot; to create one.</p>}
              </div>
            )}

            {activeTab === 'subcategories' && (
              <div className="p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Subcategories</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openAdd('subcategories')} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#0d5d57]">
                      <Plus className="w-4 h-4" /> Add subcategory
                    </button>
                    <button onClick={handleBulkDeleteSubcategories} disabled={selectedSubcategoryIds.size === 0} className="px-4 py-2 rounded-lg font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Delete selected ({selectedSubcategoryIds.size})
                    </button>
                    <button onClick={handleExportSubcategoriesCSV} className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                      <FileDown className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 py-3 px-4">
                          <input type="checkbox" checked={subcategories.length > 0 && selectedSubcategoryIds.size === subcategories.length} onChange={selectAllSubcategories} className="rounded border-gray-300 text-[#0f766e]" />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Category</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subcategories.map((s) => (
                        <tr
                          key={s.id}
                          className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedSubcategoryId === s.id ? 'bg-teal-50' : ''}`}
                          onClick={() => setSelectedSubcategoryId(selectedSubcategoryId === s.id ? null : s.id)}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedSubcategoryIds.has(s.id)} onChange={() => toggleSubcategorySelect(s.id)} className="rounded border-gray-300 text-[#0f766e]" />
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{s.name}</td>
                          <td className="py-3 px-4 text-gray-600">{s.category_name || s.category_id}</td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => openEdit('subcategories', s)} className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg mr-1" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete('subcategories', s.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {subcategories.length === 0 && <p className="text-center py-8 text-gray-500">No subcategories yet. Add a category first, then click &quot;Add subcategory&quot;.</p>}
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Tax types</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openAdd('tax')} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#0d5d57]">
                      <Plus className="w-4 h-4" /> Add tax type
                    </button>
                    <button onClick={handleBulkDeleteTax} disabled={selectedTaxIds.size === 0} className="px-4 py-2 rounded-lg font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Delete selected ({selectedTaxIds.size})
                    </button>
                    <button onClick={handleExportTaxCSV} className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                      <FileDown className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 py-3 px-4">
                          <input type="checkbox" checked={taxTypes.length > 0 && selectedTaxIds.size === taxTypes.length} onChange={selectAllTax} className="rounded border-gray-300 text-[#0f766e]" />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Rate %</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxTypes.map((t) => (
                        <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <input type="checkbox" checked={selectedTaxIds.has(t.id)} onChange={() => toggleTaxSelect(t.id)} className="rounded border-gray-300 text-[#0f766e]" />
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{t.name}</td>
                          <td className="py-3 px-4 text-right text-gray-600">{t.rate_type === 'amount' ? `$${Number(t.rate).toFixed(2)}` : `${t.rate}%`}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => openEdit('tax', t)} className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg mr-1" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete('tax', t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {taxTypes.length === 0 && <p className="text-center py-8 text-gray-500">No tax types yet. Click &quot;Add tax type&quot; to create one.</p>}
              </div>
            )}

            {activeTab === 'payment' && (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Payment methods</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openAdd('payment')} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#0d5d57]">
                      <Plus className="w-4 h-4" /> Add payment method
                    </button>
                    <button onClick={handleBulkDeletePayment} disabled={selectedPaymentIds.size === 0} className="px-4 py-2 rounded-lg font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Delete selected ({selectedPaymentIds.size})
                    </button>
                    <button onClick={handleExportPaymentCSV} className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                      <FileDown className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">These payment methods appear when receiving payment on invoices. Add or edit methods here, then select them in Receive Payment.</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 py-3 px-4">
                          <input type="checkbox" checked={paymentMethods.length > 0 && selectedPaymentIds.size === paymentMethods.length} onChange={selectAllPayment} className="rounded border-gray-300 text-[#0f766e]" />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentMethods.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <input type="checkbox" checked={selectedPaymentIds.has(p.id)} onChange={() => togglePaymentSelect(p.id)} className="rounded border-gray-300 text-[#0f766e]" />
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{p.name}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => openEdit('payment', p)} className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg mr-1" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete('payment', p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {paymentMethods.length === 0 && <p className="text-center py-8 text-gray-500">No payment methods yet. Click &quot;Add payment method&quot; to create one (e.g. Cash, Card, Bank Transfer).</p>}
              </div>
            )}

            {activeTab === 'bank' && (
              <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Bank accounts</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openAdd('bank')} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-[#0d5d57]">
                      <Plus className="w-4 h-4" /> Add bank account
                    </button>
                    <button onClick={handleBulkDeleteBank} disabled={selectedBankIds.size === 0} className="px-4 py-2 rounded-lg font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      Delete selected ({selectedBankIds.size})
                    </button>
                    <button onClick={handleExportBankCSV} className="px-4 py-2 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1">
                      <FileDown className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">When you receive payment (cash or cheque), you can record which bank account the money is deposited in. Add your bank accounts here (e.g. Main Checking, Savings).</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 py-3 px-4">
                          <input type="checkbox" checked={bankAccounts.length > 0 && selectedBankIds.size === bankAccounts.length} onChange={selectAllBank} className="rounded border-gray-300 text-[#0f766e]" />
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Account number</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankAccounts.map((b) => (
                        <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <input type="checkbox" checked={selectedBankIds.has(b.id)} onChange={() => toggleBankSelect(b.id)} className="rounded border-gray-300 text-[#0f766e]" />
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">{b.name}</td>
                          <td className="py-3 px-4 text-gray-600">{b.account_number || '—'}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => openEdit('bank', b)} className="p-2 text-[#0f766e] hover:bg-teal-50 rounded-lg mr-1" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete('bank', b.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bankAccounts.length === 0 && <p className="text-center py-8 text-gray-500">No bank accounts yet. Click &quot;Add bank account&quot; to create one (e.g. your 2 bank accounts for depositing cash and cheque).</p>}
              </div>
            )}
          </div>

          {/* Products panel for selected category */}
          {activeTab === 'categories' && selectedCategoryId && (
            <div className="mt-6 bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Package className="w-5 h-5" />
                Products in &quot;{categories.find((c) => c.id === selectedCategoryId)?.name}&quot;
              </h3>
              <p className="text-sm text-gray-600 mb-4">Click a category row above to see its products. Add or remove products from this category.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <select value={addProductId} onChange={(e) => setAddProductId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]">
                  <option value="">Select product to add...</option>
                  {productsNotInCategory.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
                <button onClick={addProductToCategory} disabled={!addProductId} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d5d57] disabled:opacity-50">
                  Add to category
                </button>
              </div>
              {productsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#0f766e] border-t-transparent" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-4">Product</th>
                        <th className="text-left py-2 px-4">SKU</th>
                        <th className="text-right py-2 px-4">Price</th>
                        <th className="text-right py-2 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsInCategory.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-2 px-4 font-medium">{p.name}</td>
                          <td className="py-2 px-4 text-gray-600">{p.sku || '—'}</td>
                          <td className="py-2 px-4 text-right">{p.price != null ? Number(p.price).toLocaleString() : '—'}</td>
                          <td className="py-2 px-4 text-right">
                            <button onClick={() => removeProductFromCategory(p.id)} className="text-red-600 hover:underline text-sm">Remove from category</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!productsLoading && productsInCategory.length === 0 && <p className="text-gray-500 py-4">No products in this category. Use the dropdown above to add products.</p>}
            </div>
          )}

          {/* Products panel for selected subcategory */}
          {activeTab === 'subcategories' && selectedSubcategoryId && (
            <div className="mt-6 bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <Package className="w-5 h-5" />
                Products in &quot;{subcategories.find((s) => s.id === selectedSubcategoryId)?.name}&quot;
              </h3>
              <p className="text-sm text-gray-600 mb-4">Click a subcategory row above to see its products. Add or remove products from this subcategory.</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <select value={addProductIdSub} onChange={(e) => setAddProductIdSub(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]">
                  <option value="">Select product to add...</option>
                  {productsNotInSubcategory.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
                <button onClick={addProductToSubcategory} disabled={!addProductIdSub} className="bg-[#0f766e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0d5d57] disabled:opacity-50">
                  Add to subcategory
                </button>
              </div>
              {productsLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#0f766e] border-t-transparent" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-4">Product</th>
                        <th className="text-left py-2 px-4">SKU</th>
                        <th className="text-right py-2 px-4">Price</th>
                        <th className="text-right py-2 px-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsInSubcategory.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-2 px-4 font-medium">{p.name}</td>
                          <td className="py-2 px-4 text-gray-600">{p.sku || '—'}</td>
                          <td className="py-2 px-4 text-right">{p.price != null ? Number(p.price).toLocaleString() : '—'}</td>
                          <td className="py-2 px-4 text-right">
                            <button onClick={() => removeProductFromSubcategory(p.id)} className="text-red-600 hover:underline text-sm">Remove from subcategory</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!productsLoading && productsInSubcategory.length === 0 && <p className="text-gray-500 py-4">No products in this subcategory. Use the dropdown above to add products.</p>}
            </div>
          )}
        </>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {modal.edit ? 'Edit' : 'Add'} {TABS.find((t) => t.id === modal!.type)?.label}
              </h2>
              <button type="button" onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {modal.type === 'categories' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input type="text" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display order</label>
                    <input type="number" min={0} value={form.display_order ?? 0} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" />
                  </div>
                </>
              )}
              {modal.type === 'subcategories' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select value={form.category_id || ''} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" required>
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {categories.length === 0 && <p className="text-xs text-amber-600 mt-1">Create a category first.</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display order</label>
                    <input type="number" min={0} value={form.display_order ?? 0} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" />
                  </div>
                </>
              )}
              {modal.type === 'tax' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" placeholder="e.g. GST, VAT" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate type</label>
                    <select value={form.rate_type || 'percent'} onChange={(e) => setForm({ ...form, rate_type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent">
                      <option value="percent">Percentage (%)</option>
                      <option value="amount">Fixed amount (USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{form.rate_type === 'amount' ? 'Amount (USD) *' : 'Rate % *'}</label>
                    <input type="number" min={0} step={0.01} value={form.rate ?? ''} onChange={(e) => setForm({ ...form, rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" required />
                  </div>
                </>
              )}
              {modal.type === 'payment' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" placeholder="e.g. Cash, Card, Bank Transfer" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display order</label>
                    <input type="number" min={0} value={form.display_order ?? 0} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value, 10) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" />
                  </div>
                </>
              )}
              {modal.type === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank account name *</label>
                    <input type="text" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" placeholder="e.g. Main Checking, Savings" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account number</label>
                    <input type="text" value={form.account_number || ''} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f766e] focus:border-transparent" placeholder="Optional" />
                  </div>
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#0f766e] text-white py-2.5 rounded-lg font-medium hover:bg-[#0d5d57]">Save</button>
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
