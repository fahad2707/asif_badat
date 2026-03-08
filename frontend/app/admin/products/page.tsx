'use client';

import { useEffect, useState, useRef } from 'react';
import { Plus, Edit, Trash2, Search, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, FileDown } from 'lucide-react';
import adminApi, { uploadApi } from '@/lib/admin-api';
import toast from 'react-hot-toast';
import ProductModal from '@/components/admin/ProductModal';

interface Product {
  id: string | number;
  name: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold?: number;
  barcode?: string;
  category_name?: string;
  image_url?: string;
  is_active: boolean;
  sku?: string;
  description?: string;
  cost_price?: number;
  tax_rate?: number;
}

interface PreviewRow {
  rowIndex: number;
  data: {
    category: string;
    subcategory: string;
    name: string;
    price: number;
    cost_price: number;
    sku: string | null;
    barcode: string | null;
    stock_quantity: number;
    tax_rate: number;
    is_active: boolean;
  } | null;
  errors: string[];
  status: 'valid' | 'invalid' | 'duplicate_skipped';
}

interface ImportPreviewResult {
  rows: PreviewRow[];
  summary: { total: number; valid: number; invalid: number; duplicate_skipped: number };
}

interface ImportExecuteResult {
  imported: number;
  failed: number;
  duplicate_skipped: number;
  total: number;
  errors: { row: number; message: string }[];
  duplicate_skipped_rows?: { row: number; message: string }[];
  categories_created: number;
  subcategories_created: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [importStep, setImportStep] = useState<'idle' | 'preview' | 'importing' | 'done'>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportExecuteResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  const fetchProducts = async () => {
    try {
      const response = await adminApi.get('/products', { params: { limit: 5000 } });
      setProducts(response.data.products || []);
      setTotalCount(response.data.pagination?.total ?? (response.data.products?.length ?? 0));
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }
    setSelectedFile(file);
    setImportResult(null);
    setImportStep('preview');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await uploadApi.post<ImportPreviewResult>('/products/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
      toast.success('Preview ready. Review and confirm to import.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to parse CSV');
      setPreview(null);
      setImportStep('idle');
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    setImportStep('importing');
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const { data } = await uploadApi.post<ImportExecuteResult>('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      setImportStep('done');
      if (data.imported > 0) {
        toast.success(`${data.imported} products imported`);
        fetchProducts();
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} row(s) failed`);
      }
      if (data.duplicate_skipped > 0) {
        toast(`${data.duplicate_skipped} duplicate(s) skipped`, { icon: '⚠️' });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Import failed');
      setImportStep('preview');
    }
  };

  const handleCloseImport = () => {
    setImportStep('idle');
    setSelectedFile(null);
    setPreview(null);
    setImportResult(null);
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await adminApi.delete(`/products/${id}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const toggleSelect = (id: string | number) => {
    const s = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredProducts.map((p) => String(p.id))));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected product(s)?`)) return;
    try {
      await adminApi.post('/products/bulk-delete', { ids: Array.from(selectedIds) });
      toast.success(`${selectedIds.size} product(s) deleted`);
      setSelectedIds(new Set());
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleExportSelected = () => {
    if (selectedIds.size === 0) return;
    const rows = filteredProducts.filter((p) => selectedIds.has(String(p.id)));
    // QuickBooks-compatible columns: name, sku, price, tax_rate, cost_price, description, stock_quantity, category (no PLU, Barcode, picture)
    const headers = ['name', 'sku', 'price', 'tax_rate', 'cost_price', 'description', 'stock_quantity', 'category'];
    const csvRows = [
      headers.join(','),
      ...rows.map((p) =>
        [
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.sku || '').replace(/"/g, '""')}"`,
          parseFloat(String(p.price)).toFixed(2),
          String(p.tax_rate ?? 0),
          parseFloat(String(p.cost_price ?? 0)).toFixed(2),
          `"${(p.description || '').replace(/"/g, '""')}"`,
          p.stock_quantity,
          `"${(p.category_name || '').replace(/"/g, '""')}"`,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} product(s). QuickBooks-compatible.`);
  };

  const lowStockThreshold = (p: Product) => p.low_stock_threshold ?? 10;
  const lowStockCount = products.filter((p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= lowStockThreshold(p)).length;
  const outOfStockCount = products.filter((p) => (p.stock_quantity ?? 0) <= 0).length;

  const filteredBySearch = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredProducts =
    stockFilter === 'low_stock'
      ? filteredBySearch.filter((p) => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= lowStockThreshold(p))
      : stockFilter === 'out_of_stock'
        ? filteredBySearch.filter((p) => (p.stock_quantity ?? 0) <= 0)
        : filteredBySearch;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Products</h1>
          {totalCount !== null && (
            <p className="text-gray-600 mt-1 font-medium">Total: {totalCount.toLocaleString()} product{totalCount !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
          <a
            href="/product-import-sample.csv"
            download="product-import-sample.csv"
            className="bg-gray-100 text-gray-700 px-5 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2 border border-gray-300"
          >
            <FileSpreadsheet className="w-5 h-5" />
            Sample CSV
          </a>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gray-100 text-gray-700 px-5 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center gap-2 border border-gray-300"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="bg-[#0f766e] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#0d5d57] transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add new product
          </button>
        </div>
      </div>

      {/* Low stock / Out of stock indicators - click to filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setStockFilter(stockFilter === 'low_stock' ? 'all' : 'low_stock')}
          className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
            stockFilter === 'low_stock' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/50'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-700">{lowStockCount}</p>
            <p className="text-sm font-medium text-gray-600">LOW STOCK</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
          className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${
            stockFilter === 'out_of_stock' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50/50'
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <XCircle className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-700">{outOfStockCount}</p>
            <p className="text-sm font-medium text-gray-600">OUT OF STOCK</p>
          </div>
        </button>
      </div>
      {stockFilter !== 'all' && (
        <p className="text-sm text-gray-600 mb-2">
          Showing only {stockFilter === 'low_stock' ? 'low stock' : 'out of stock'} products.
          <button type="button" onClick={() => setStockFilter('all')} className="ml-2 text-[#0f766e] font-medium hover:underline">Show all</button>
        </p>
      )}

      {/* Import preview / progress / summary */}
      {importStep === 'preview' && preview && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Import preview</h2>
          <p className="text-sm text-gray-600 mb-4">
            File: <span className="font-medium">{selectedFile?.name}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{preview.summary.total}</p>
              <p className="text-sm text-gray-500">Total rows</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-700">{preview.summary.valid}</p>
              <p className="text-sm text-green-600">Ready to import</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-700">{preview.summary.invalid}</p>
              <p className="text-sm text-red-600">Invalid</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-amber-700">{preview.summary.duplicate_skipped}</p>
              <p className="text-sm text-amber-600">Duplicates (in file)</p>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 text-gray-700">Row</th>
                  <th className="text-left py-2 px-3 text-gray-700">Status</th>
                  <th className="text-left py-2 px-3 text-gray-700">Category / Sub</th>
                  <th className="text-left py-2 px-3 text-gray-700">Product</th>
                  <th className="text-right py-2 px-3 text-gray-700">Price</th>
                  <th className="text-left py-2 px-3 text-gray-700">Errors</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 px-3 font-mono text-gray-600">{r.rowIndex}</td>
                    <td className="py-2 px-3">
                      {r.status === 'valid' && <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="w-4 h-4" /> Valid</span>}
                      {r.status === 'invalid' && <span className="inline-flex items-center gap-1 text-red-600"><XCircle className="w-4 h-4" /> Invalid</span>}
                      {r.status === 'duplicate_skipped' && <span className="inline-flex items-center gap-1 text-amber-600"><AlertCircle className="w-4 h-4" /> Duplicate</span>}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {r.data ? `${r.data.category}${r.data.subcategory ? ' / ' + r.data.subcategory : ''}` : '-'}
                    </td>
                    <td className="py-2 px-3 font-medium text-gray-900">{r.data?.name ?? '-'}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{r.data ? `$${r.data.price.toFixed(2)}` : '-'}</td>
                    <td className="py-2 px-3 text-red-600 text-xs">{r.errors.join('; ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 50 && (
            <p className="text-sm text-gray-500 mb-4">Showing first 50 rows. All will be processed on import.</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleConfirmImport}
              disabled={preview.summary.valid === 0}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import {preview.summary.valid} product{preview.summary.valid !== 1 ? 's' : ''}
            </button>
            <button onClick={handleCloseImport} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {importStep === 'importing' && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 mb-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-700 font-medium">Importing products…</p>
          <p className="text-sm text-gray-500 mt-1">Do not close this page.</p>
        </div>
      )}

      {importStep === 'done' && importResult && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Import summary</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">{importResult.total}</p>
              <p className="text-sm text-gray-500">Total rows</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
              <p className="text-sm text-green-600">Imported</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
              <p className="text-sm text-red-600">Failed</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-amber-700">{importResult.duplicate_skipped}</p>
              <p className="text-sm text-amber-600">Duplicates skipped</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-blue-700">{importResult.categories_created + importResult.subcategories_created}</p>
              <p className="text-sm text-blue-600">Categories/Subs created</p>
            </div>
          </div>
          {(importResult.errors?.length > 0 || importResult.duplicate_skipped_rows?.length) && (
            <div className="max-h-40 overflow-y-auto text-sm mb-4">
              <p className="text-gray-600 font-medium mb-1">Errors / skipped:</p>
              <ul className="list-disc list-inside text-red-600 space-y-0.5">
                {importResult.errors?.slice(0, 20).map((e, i) => (
                  <li key={i}>Row {e.row}: {e.message}</li>
                ))}
                {importResult.duplicate_skipped_rows?.slice(0, 10).map((e, i) => (
                  <li key={`d-${i}`} className="text-amber-600">Row {e.row}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={handleCloseImport} className="px-6 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">
            Close
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-600 font-medium">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={handleExportSelected}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export to Excel
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 py-3 px-4 text-center text-gray-700">#</th>
                <th className="w-12 py-3 px-4">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="text-left py-3 px-4 text-gray-700">Product</th>
                <th className="text-left py-3 px-4 text-gray-700">Category</th>
                <th className="text-right py-3 px-4 text-gray-700">Price</th>
                <th className="text-right py-3 px-4 text-gray-700">Stock</th>
                <th className="text-left py-3 px-4 text-gray-700">Barcode</th>
                <th className="text-right py-3 px-4 text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => (
                <tr key={String(product.id)} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-center text-gray-600 font-medium">{index + 1}</td>
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(product.id))}
                      onChange={() => toggleSelect(product.id)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />
                      )}
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{product.category_name || '-'}</td>
                  <td className="py-3 px-4 text-right font-semibold text-gray-900">
                    ${parseFloat(product.price.toString()).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={product.stock_quantity <= 10 ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700 font-mono text-sm">{product.barcode || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditingProduct(product); setShowModal(true); }}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(String(product.id))}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProductModal
          product={editingProduct ? { ...editingProduct, low_stock_threshold: editingProduct.low_stock_threshold ?? 10 } : null}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  );
}
