import express from 'express';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import POSSale from '../models/POSSale';
import Invoice from '../models/Invoice';
import Product from '../models/Product';
import PurchaseOrder from '../models/PurchaseOrder';
import Customer from '../models/Customer';
import Vendor from '../models/Vendor';
import Category from '../models/Category';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get dashboard stats (AIC-style KPIs + charts)
router.get('/dashboard', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { period = '365' } = req.query;
    const days = Math.min(parseInt(period as string) || 365, 730);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Paid website orders in period
    const orders = await Order.find({
      created_at: { $gte: startDate },
      payment_status: 'paid',
    }).lean();

    const onlineRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    // POS sales in period
    const posSales = await POSSale.find({
      created_at: { $gte: startDate },
    }).lean();

    const offlineRevenue = posSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);

    // Manual invoices in period (admin portal)
    const invoices = await Invoice.find({
      created_at: { $gte: startDate },
    }).lean();
    const invoiceRevenue = invoices.reduce((sum, inv: any) => sum + (inv.total_amount || 0), 0);

    const totalSales = Number(onlineRevenue) + Number(offlineRevenue) + Number(invoiceRevenue);

    // Total purchases (POs)
    const pos_agg = await PurchaseOrder.aggregate([
      { $match: { created_at: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: '$total_amount' } } },
    ]);
    const totalPurchases = Number(pos_agg[0]?.total || 0);

    const netProfit = totalSales - totalPurchases;

    // Receivable: from invoices (total_amount - amount_paid for open invoices)
    const totalReceivable = invoices.reduce((sum, inv: any) => {
      const due = (inv.total_amount || 0) - (inv.amount_paid || 0);
      return sum + (due > 0 ? due : 0);
    }, 0);

    // Payable: total PO amount in period (simple approximation)
    const totalPayable = Number(pos_agg[0]?.total || 0);

    // Top sales location: by pickup_location (orders) + customer_address (invoices)
    const locMap = new Map<string, number>();
    orders.forEach((o: any) => {
      const loc = o.pickup_location || 'Unknown';
      locMap.set(loc, (locMap.get(loc) || 0) + (o.total_amount || 0));
    });
    invoices.forEach((inv: any) => {
      const loc = inv.customer_address || 'Unknown';
      locMap.set(loc, (locMap.get(loc) || 0) + (inv.total_amount || 0));
    });
    const topSalesLocation =
      Array.from(locMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Top selling item: derive from website orders + manual invoices
    const orderItems = await OrderItem.find({
      order_id: { $in: orders.map((o: any) => o._id) },
    })
      .populate({ path: 'product_id', populate: { path: 'category_id', model: 'Category' } })
      .lean();
    const categoryRevenue = new Map<string, number>();
    orderItems.forEach((item: any) => {
      const catName = item.product_id?.category_id?.name || 'Uncategorized';
      categoryRevenue.set(catName, (categoryRevenue.get(catName) || 0) + (item.subtotal || 0));
    });
    invoices.forEach((inv: any) => {
      (inv.items || []).forEach((it: any) => {
        const catName = it.category_name || 'Uncategorized';
        categoryRevenue.set(catName, (categoryRevenue.get(catName) || 0) + (it.subtotal || 0));
      });
    });
    const topSellingItem =
      Array.from(categoryRevenue.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Sales trend (monthly)
    const monthMap = new Map<string, number>();
    for (let i = 0; i < 24; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }
    orders.forEach((o: any) => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + (o.total_amount || 0));
    });
    posSales.forEach((s: any) => {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + (s.total_amount || 0));
    });
    const salesTrend = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, sales]) => ({ month, sales }));

    // Top 10 customers (by order total; we don't have customer_id on Order, use order count / total as proxy or leave from Receipts/Customer)
    // Top 10 customers from manual invoices
    const top10Customers: Array<{ name: string; sales: number }> = [];
    const customerMap = new Map<string, number>();
    invoices.forEach((inv: any) => {
      const name = inv.customer_name || 'Customer';
      customerMap.set(name, (customerMap.get(name) || 0) + (inv.total_amount || 0));
    });
    customerMap.forEach((value, name) => {
      top10Customers.push({ name, sales: Math.round(value) });
    });
    top10Customers.sort((a, b) => b.sales - a.sales);
    if (top10Customers.length > 10) top10Customers.splice(10);

    // Purchase by location (vendor state)
    const poList = await PurchaseOrder.find({ created_at: { $gte: startDate } })
      .populate('vendor_id', 'state')
      .lean();
    const purchaseByLocationMap = new Map<string, number>();
    poList.forEach((po: any) => {
      const state = po.vendor_id?.state || 'Unknown';
      purchaseByLocationMap.set(state, (purchaseByLocationMap.get(state) || 0) + (po.total_amount || 0));
    });
    const totalPurchLoc = Array.from(purchaseByLocationMap.values()).reduce((a, b) => a + b, 0);
    const purchaseByLocation = Array.from(purchaseByLocationMap.entries()).map(([name, value]) => ({
      name,
      value: totalPurchLoc ? Math.round((value / totalPurchLoc) * 1000) / 10 : 0,
    }));

    // Purchase by category (from PO items -> product -> category)
    const purchaseByCategoryMap = new Map<string, { y2024: number; y2025: number }>();
    for (const po of poList) {
      const year = new Date((po as any).created_at).getFullYear();
      const items = (po as any).items || [];
      for (const it of items) {
        const prod = await Product.findById(it.product_id).populate('category_id').lean();
        const catName = (prod as any)?.category_id?.name || 'Uncategorized';
        const entry = purchaseByCategoryMap.get(catName) || { y2024: 0, y2025: 0 };
        if (year === 2024) entry.y2024 += it.subtotal || 0;
        else entry.y2025 += it.subtotal || 0;
        purchaseByCategoryMap.set(catName, entry);
      }
    }
    const purchaseByCategory = Array.from(purchaseByCategoryMap.entries()).map(([name, v]) => ({
      name,
      y2024: Math.round(v.y2024),
      y2025: Math.round(v.y2025),
    }));

    // Sales by location (pickup_location)
    const salesByLocation = Array.from(locMap.entries()).map(([name, value]) => ({
      name,
      sales: Math.round(value),
    })).sort((a, b) => b.sales - a.sales);

    // Sales by category (donut)
    const totalCat = Array.from(categoryRevenue.values()).reduce((a, b) => a + b, 0);
    const salesByCategory = Array.from(categoryRevenue.entries()).map(([name, value]) => ({
      name,
      value: totalCat ? Math.round((value / totalCat) * 1000) / 10 : 0,
    }));

    // Sales by city (use pickup_location as "city" for treemap)
    const cityMap = new Map<string, number>();
    orders.forEach((o: any) => {
      const loc = o.pickup_location || 'Unknown';
      cityMap.set(loc, (cityMap.get(loc) || 0) + (o.total_amount || 0));
    });
    invoices.forEach((inv: any) => {
      const loc = inv.customer_address || 'Unknown';
      cityMap.set(loc, (cityMap.get(loc) || 0) + (inv.total_amount || 0));
    });
    const salesByCity = Array.from(cityMap.entries()).map(([name, value]) => ({
      name,
      size: Math.round(value),
    })).sort((a, b) => b.size - a.size);

    // Low stock & top products (existing)
    const allProducts = await Product.find({ is_active: true }).lean();
    const lowStockCount = allProducts.filter(
      (p: any) => p.stock_quantity <= (p.low_stock_threshold || 10)
    ).length;

    const productSales = new Map<string, { name: string; image_url?: string; total_sold: number; revenue: number }>();
    orderItems.forEach((item: any) => {
      if (!item.product_id) return;
      const productId = (item.product_id as any)._id.toString();
      const existing = productSales.get(productId) || {
        name: (item.product_id as any).name,
        image_url: (item.product_id as any).image_url,
        total_sold: 0,
        revenue: 0,
      };
      existing.total_sold += item.quantity || 0;
      existing.revenue += item.subtotal || 0;
      productSales.set(productId, existing);
    });
    invoices.forEach((inv: any) => {
      (inv.items || []).forEach((it: any) => {
        if (!it.product_id) return;
        const productId = String(it.product_id);
        const existing = productSales.get(productId) || {
          name: it.product_name || 'Product',
          image_url: undefined,
          total_sold: 0,
          revenue: 0,
        };
        existing.total_sold += it.quantity || 0;
        existing.revenue += it.subtotal || 0;
        productSales.set(productId, existing);
      });
    });
    for (const sale of posSales) {
      const items = (sale as any).items || [];
      for (const it of items) {
        if (it.product_id) {
          const product = await Product.findById(it.product_id).lean();
          if (product) {
            const productId = (product as any)._id.toString();
            const existing = productSales.get(productId) || {
              name: (product as any).name,
              image_url: (product as any).image_url,
              total_sold: 0,
              revenue: 0,
            };
            existing.total_sold += it.quantity || 0;
            existing.revenue += it.subtotal || 0;
            productSales.set(productId, existing);
          }
        }
      }
    }
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 10)
      .map((p, index) => ({
        id: index + 1,
        name: p.name,
        image_url: p.image_url,
        total_sold: p.total_sold,
        revenue: p.revenue,
      }));

    res.json({
      revenue: totalSales,
      orders: invoices.length,
      onlineSales: Number(invoiceRevenue),
      offlineSales: Number(offlineRevenue),
      lowStockCount: Number(lowStockCount),
      topProducts: Array.isArray(topProducts) ? topProducts : [],
      totalSales,
      totalPurchases,
      netProfit,
      totalReceivable,
      totalPayable,
      topSalesLocation,
      topSellingItem,
      salesTrend,
      top10Customers,
      purchaseByLocation,
      purchaseByCategory,
      salesByLocation,
      salesByCategory,
      salesByCity,
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Get low stock products
router.get('/low-stock', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const allProducts = await Product.find({ is_active: true })
      .populate('category_id', 'name')
      .lean();
    
    const products = allProducts.filter(
      (p: any) => p.stock_quantity <= (p.low_stock_threshold || 10)
    ).sort((a: any, b: any) => a.stock_quantity - b.stock_quantity);

    res.json(
      products.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        price: p.price,
        stock_quantity: p.stock_quantity,
        low_stock_threshold: p.low_stock_threshold,
        category_name: p.category_id?.name,
        image_url: p.image_url,
        barcode: p.barcode,
      }))
    );
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

export default router;
