import express from 'express';
import mongoose from 'mongoose';
import OnlineOrder from '../models/OnlineOrder';
import Product from '../models/Product';
import Invoice from '../models/Invoice';
import StockMovement from '../models/StockMovement';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

async function getNextOrderNumber(): Promise<string> {
  const last = await OnlineOrder.findOne().sort({ created_at: -1 }).lean();
  if (!last) return 'WEB-0001';
  const match = (last as any).order_number?.match(/WEB-(\d+)/);
  const next = match ? parseInt(match[1]) + 1 : 1;
  return `WEB-${String(next).padStart(4, '0')}`;
}

// Public: place an order (no auth required - this is from the storefront)
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    if (!body.customer_name || !body.customer_email || !body.customer_phone) {
      return res.status(400).json({ error: 'Customer name, email, and phone are required' });
    }
    if (!body.address_line1 || !body.city || !body.state || !body.zip) {
      return res.status(400).json({ error: 'Full address is required' });
    }
    if (!body.items || !body.items.length) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (!body.payment_method || !['cod', 'card'].includes(body.payment_method)) {
      return res.status(400).json({ error: 'Valid payment method is required' });
    }

    const orderItems: any[] = [];
    let subtotal = 0;
    let totalTax = 0;

    for (const item of body.items) {
      const product = await Product.findById(item.product_id).lean();
      if (!product) {
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      const p = product as any;
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || Number(p.price) || 0;
      const taxRate = Number(p.tax_rate) || 0;
      const lineSubtotal = price * qty;
      const lineTax = Math.round(lineSubtotal * (taxRate / 100) * 100) / 100;

      subtotal += lineSubtotal;
      totalTax += lineTax;

      orderItems.push({
        product_id: new mongoose.Types.ObjectId(item.product_id),
        product_name: p.name,
        quantity: qty,
        price,
        tax_rate: taxRate,
        subtotal: lineSubtotal,
      });
    }

    const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;
    const orderNumber = await getNextOrderNumber();

    const order = await OnlineOrder.create({
      order_number: orderNumber,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone,
      address_line1: body.address_line1,
      address_line2: body.address_line2 || '',
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country || 'US',
      items: orderItems,
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(totalTax * 100) / 100,
      total_amount: totalAmount,
      payment_method: body.payment_method,
      payment_status: body.payment_method === 'card' ? 'paid' : 'pending',
      card_last4: body.card_last4 || undefined,
      card_brand: body.card_brand || undefined,
      status: 'confirmed',
      status_history: [{ status: 'confirmed', timestamp: new Date() }],
      notes: body.notes || undefined,
    });

    const doc = order.toObject() as any;
    res.status(201).json({
      id: doc._id.toString(),
      order_number: doc.order_number,
      total_amount: doc.total_amount,
      status: doc.status,
    });
  } catch (error) {
    console.error('Create online order error:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// Public: get order by number (for confirmation page)
router.get('/track/:orderNumber', async (req, res) => {
  try {
    const order = await OnlineOrder.findOne({ order_number: req.params.orderNumber }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const o = order as any;
    res.json({
      id: o._id.toString(),
      order_number: o.order_number,
      customer_name: o.customer_name,
      status: o.status,
      items: o.items,
      subtotal: o.subtotal,
      tax_amount: o.tax_amount,
      total_amount: o.total_amount,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      status_history: o.status_history,
      created_at: o.created_at,
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Admin: list all online orders
router.get('/', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { status } = req.query;
    const filter: any = {};
    if (status && status !== 'all') filter.status = status;
    const orders = await OnlineOrder.find(filter).sort({ created_at: -1 }).lean();
    res.json(orders.map((o: any) => ({
      id: o._id.toString(),
      order_number: o.order_number,
      customer_name: o.customer_name,
      customer_email: o.customer_email,
      customer_phone: o.customer_phone,
      address_line1: o.address_line1,
      address_line2: o.address_line2,
      city: o.city,
      state: o.state,
      zip: o.zip,
      items: o.items,
      subtotal: o.subtotal,
      tax_amount: o.tax_amount,
      total_amount: o.total_amount,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      status: o.status,
      status_history: o.status_history,
      invoice_id: o.invoice_id?.toString(),
      created_at: o.created_at,
    })));
  } catch (error) {
    console.error('List online orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin: update order status
router.put('/:id/status', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'packed', 'dispatched', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await OnlineOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Delivered orders cannot be modified' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled orders cannot be modified' });
    }

    order.status = status;
    order.status_history.push({ status, timestamp: new Date() } as any);

    // On delivered: subtract inventory + generate invoice
    if (status === 'delivered') {
      if (order.payment_method === 'cod') {
        order.payment_status = 'paid';
      }

      for (const item of order.items) {
        if (!item.product_id) continue;
        const product = await Product.findById(item.product_id);
        if (!product) continue;
        if ((product as any).product_type === 'service' || (product as any).product_type === 'non_inventory') continue;
        await Product.findByIdAndUpdate(item.product_id, { $inc: { stock_quantity: -item.quantity } });
        await StockMovement.create({
          product_id: item.product_id,
          type: 'sale',
          quantity: -item.quantity,
          reference: `Online Order ${order.order_number}`,
        }).catch(() => {});
      }

      // Auto-generate invoice
      try {
        const invoiceNumber = `INV-WEB-${order.order_number.replace('WEB-', '')}`;
        const LOCATION_OF_SALE = '511 W Germantown Pike, Plymouth Meeting, PA 19462-1303';
        const inv = await Invoice.create({
          invoice_number: invoiceNumber,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          customer_address: [order.address_line1, order.address_line2, order.city, order.state, order.zip].filter(Boolean).join(', '),
          location_of_sale: LOCATION_OF_SALE,
          invoice_type: 'invoice',
          invoice_date: new Date(),
          due_date: new Date(),
          subtotal_amount: order.subtotal,
          tax_amount: order.tax_amount,
          total_amount: order.total_amount,
          amount_paid: order.total_amount,
          terms: 'Paid',
          payment_status: 'paid',
          items: order.items.map((i: any) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal,
          })),
        });
        order.invoice_id = inv._id as any;
      } catch (invErr) {
        console.error('Auto invoice error:', invErr);
      }
    }

    await order.save();
    res.json({ message: `Order marked as ${status}`, status: order.status });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Admin: get order summary counts
router.get('/summary', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const [confirmed, packed, dispatched, delivered, cancelled, total] = await Promise.all([
      OnlineOrder.countDocuments({ status: 'confirmed' }),
      OnlineOrder.countDocuments({ status: 'packed' }),
      OnlineOrder.countDocuments({ status: 'dispatched' }),
      OnlineOrder.countDocuments({ status: 'delivered' }),
      OnlineOrder.countDocuments({ status: 'cancelled' }),
      OnlineOrder.countDocuments(),
    ]);
    res.json({ confirmed, packed, dispatched, delivered, cancelled, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

export default router;
