'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Wallet, ClipboardList, Tag, AlertTriangle } from 'lucide-react';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';
import Link from 'next/link';

const COLORS = ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'];

export default function AdminDashboard() {
  const [data, setData] = useState<{
    totalSales?: number;
    totalPurchases?: number;
    totalCOGS?: number;
    totalExpenses?: number;
    netProfit?: number;
    totalReceivable?: number;
    totalPayable?: number;
    topSellingItem?: string;
    salesTrend?: Array<{ month: string; sales: number }>;
    top10Customers?: Array<{ name: string; sales: number }>;
    purchaseByLocation?: Array<{ name: string; value: number }>;
    purchaseByCategory?: Array<{ name: string; y2024: number; y2025: number }>;
    salesByLocation?: Array<{ name: string; sales: number }>;
    salesByCategory?: Array<{ name: string; value: number }>;
    salesByCity?: Array<{ name: string; size: number }>;
    lowStockCount?: number;
    topProducts?: Array<{ id: number; name: string; image_url?: string; total_sold: number; revenue: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await adminApi.get('/admin/dashboard', { params: { period: '365' } });
      setData(res.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#0f766e] border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    { title: 'Total Sales', value: `$${Number(data.totalSales ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-green-600' },
    { title: 'Total Purchases', value: `$${Number(data.totalPurchases ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: ShoppingCart, color: 'text-blue-600' },
    { title: 'Net Profit', value: `$${Number(data.netProfit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-emerald-700' },
    { title: 'Total Receivable', value: `$${Number(data.totalReceivable ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Wallet, color: 'text-amber-600' },
    { title: 'Total Payable', value: `$${Number(data.totalPayable ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: ClipboardList, color: 'text-gray-600' },
    { title: 'Top Selling Item', value: data.topSellingItem || '—', icon: Tag, color: 'text-teal-600' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-600 mt-1">Key trends and business insights</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mt-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.title} className="bg-white rounded-xl shadow border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{k.title}</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5">{k.value}</p>
                </div>
                <div className={k.color}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
        <p className="font-medium text-gray-900 mb-1">Calculation (synced with invoices, POS, orders, POs &amp; expenses)</p>
        <p>
          <span className="font-medium">Total Sales</span> (${Number(data.totalSales ?? 0).toFixed(2)})
          {' − COGS '}(${Number(data.totalCOGS ?? 0).toFixed(2)})
          {' − Expenses '}(${Number(data.totalExpenses ?? 0).toFixed(2)})
          {' = '}
          <span className="font-semibold text-[#0f766e]">Net Profit ${Number(data.netProfit ?? 0).toFixed(2)}</span>
        </p>
      </div>

      {Number(data.lowStockCount) > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <div>
            <p className="font-semibold text-amber-900">{data.lowStockCount} products are running low on stock</p>
            <Link href="/admin/inventory" className="text-amber-700 hover:text-amber-900 text-sm">
              View inventory →
            </Link>
          </div>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Sales Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={Array.isArray(data.salesTrend) && data.salesTrend.length > 0 ? data.salesTrend : [{ month: new Date().toISOString().slice(0, 7), sales: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
              <Tooltip formatter={(v: number) => [`$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Sales']} labelFormatter={(label) => `Month: ${label}`} />
              <Line type="monotone" dataKey="sales" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} name="Sales" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Top 10 Customers</h2>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {(data.top10Customers && data.top10Customers.length > 0)
              ? data.top10Customers.slice(0, 10).map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-gray-700 truncate">{c.name}</span>
                    <span className="text-[#0f766e] font-medium bg-teal-50 px-2 py-0.5 rounded text-sm">
                      {c.sales >= 1000 ? `${(c.sales / 1000).toFixed(0)}K` : c.sales}
                    </span>
                  </div>
                ))
              : (
                  <p className="text-gray-500 text-sm">No customer data yet.</p>
                )}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Purchase By Location</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.purchaseByLocation || []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, value }) => `${name} ${value}%`}
              >
                {(data.purchaseByLocation || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Purchase By Category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.purchaseByCategory || []} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="y2024" name="2024" fill="#0d9488" stackId="a" />
              <Bar dataKey="y2025" name="2025" fill="#0f766e" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Sales By Location</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.salesByLocation || []} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`$${Number(v).toLocaleString()}`, 'Sales']} />
              <Bar dataKey="sales" fill="#0f766e" name="Sales" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Sales By Category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.salesByCategory || []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                label={({ name, value }) => `${name} ${value}%`}
              >
                {(data.salesByCategory || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales By City */}
      <div className="mt-6 bg-white rounded-xl shadow border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Sales By City</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.salesByCity || []} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" width={76} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`$${Number(v).toLocaleString()}`, 'Sales']} />
            <Bar dataKey="size" fill="#0f766e" name="Sales" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="mt-6 bg-white rounded-xl shadow border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Top Selling Products</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-gray-600 text-sm font-medium">Product</th>
                <th className="text-right py-2 px-3 text-gray-600 text-sm font-medium">Qty Sold</th>
                <th className="text-right py-2 px-3 text-gray-600 text-sm font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(data.topProducts || []).map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      {p.image_url && (
                        <img src={p.image_url} alt="" className="w-10 h-10 object-cover rounded" />
                      )}
                      <span className="font-medium text-gray-900">{p.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-gray-700">{p.total_sold}</td>
                  <td className="text-right py-2 px-3 font-medium text-gray-900">${Number(p.revenue).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
