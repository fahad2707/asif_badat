import express from 'express';
import mongoose from 'mongoose';
import Invoice from '../models/Invoice';
import Customer from '../models/Customer';
import Receipt from '../models/Receipt';
import StoreSettings from '../models/StoreSettings';
import Product from '../models/Product';
import CustomerProductPrice from '../models/CustomerProductPrice';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

const router = express.Router();

const LOCATION_OF_SALE = '511 W Germantown Pike, Plymouth Meeting, PA 19462-1303';

async function saveCustomerProductPrices(customerId: string | mongoose.Types.ObjectId, items: any[], invoiceId: string | mongoose.Types.ObjectId, invoiceDate: Date) {
  if (!customerId) return;
  const cid = typeof customerId === 'string' ? new mongoose.Types.ObjectId(customerId) : customerId;
  const iid = typeof invoiceId === 'string' ? new mongoose.Types.ObjectId(invoiceId) : invoiceId;
  const ops = items
    .filter((i: any) => i.product_id && Number(i.price) > 0)
    .map((i: any) => ({
      updateOne: {
        filter: { customer_id: cid, product_id: typeof i.product_id === 'string' ? new mongoose.Types.ObjectId(i.product_id) : i.product_id },
        update: { $set: { last_price: Number(i.price), last_invoice_id: iid, last_invoice_date: invoiceDate } },
        upsert: true,
      },
    }));
  if (ops.length > 0) {
    await CustomerProductPrice.bulkWrite(ops).catch((err) => console.error('Save customer prices error:', err));
  }
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const TEAL = '#0f766e';
const GRAY_HEADER = '#374151';
const LIGHT_BG = '#f3f4f6';
const BORDER_GRAY = '#e5e7eb';

// Generate PDF invoice: logo top-left, clean layout, straight watermark, product SKU as item ID, minimal color
const generateInvoicePDF = async (invoice: any, items: any[], skuMap: Record<string, string> = {}): Promise<string> => {
  const filename = `invoice-${invoice.invoice_number}.pdf`;
  const uploadsDir = path.join(__dirname, '../../uploads/invoices');
  const uploadsRoot = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const filepath = path.join(uploadsDir, filename);
  if (fs.existsSync(filepath)) {
    try { fs.unlinkSync(filepath); } catch (_) {}
  }

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  doc.pipe(fs.createWriteStream(filepath));

  const settings = await StoreSettings.findOne().lean().catch(() => null) as any;
  const businessName = settings?.business_name || 'Express Distributors Inc';
  const addressParts = [settings?.address, settings?.city, settings?.state, settings?.zip].filter(Boolean);
  const companyAddress = addressParts.length ? addressParts.join(', ') : '';
  const companyPhone = settings?.phone || '';
  const companyWebsite = settings?.website || 'www.expressdistributors.com';
  const logoPath = settings?.logo_url ? (path.isAbsolute(settings.logo_url) ? settings.logo_url : path.join(uploadsRoot, settings.logo_url)) : '';

  // ----- Watermark: straight (horizontal), centered, light gray -----
  doc.save();
  doc.fillColor('#e5e7eb');
  doc.fontSize(52);
  doc.font('Helvetica-Bold');
  doc.text(businessName.toUpperCase(), MARGIN, PAGE_HEIGHT / 2 - 18, { width: CONTENT_WIDTH, align: 'center' });
  doc.restore();

  // ----- Header: Logo (top-left) then company details -----
  let y = MARGIN;
  const headerLeft = MARGIN;
  let contentStartX = headerLeft;
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, headerLeft, y, { width: 88, height: 44 });
      contentStartX = headerLeft + 100;
    } catch (_) {}
  }
  doc.fillColor(GRAY_HEADER);
  doc.fontSize(18);
  doc.font('Helvetica-Bold');
  doc.text(businessName, contentStartX, y);
  doc.font('Helvetica');
  doc.fontSize(10);
  doc.fillColor('#6b7280');
  doc.text(companyAddress || '—', contentStartX, y + 20);
  doc.text(companyWebsite, contentStartX, y + 32);
  if (companyPhone) doc.text(`Phone: ${companyPhone}`, contentStartX, y + 44);
  doc.fillColor('black');

  y += 58;
  doc.strokeColor(TEAL);
  doc.lineWidth(1.5);
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
  doc.lineWidth(1);
  doc.strokeColor('black');
  y += 12;
  doc.fillColor(TEAL);
  doc.fontSize(14);
  doc.font('Helvetica-Bold');
  doc.text('INVOICE', MARGIN, y);
  doc.fillColor('black');
  doc.font('Helvetica');
  y += 20;

  // ----- Order details (left) | Ship To (right) -----
  const orderDate = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : (invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—');
  const terms = invoice.terms || (invoice.payment_method === 'cash' ? 'C.O.D. - CASH' : invoice.payment_method || '—');
  const shippingType = invoice.shipping_type || invoice.invoice_type || 'Ground Shipping';
  doc.fontSize(10);
  doc.fillColor(GRAY_HEADER);
  doc.font('Helvetica-Bold');
  doc.text('Order No.:', MARGIN, y);
  doc.font('Helvetica');
  doc.fillColor('black');
  doc.text(invoice.invoice_number, MARGIN + 58, y);
  doc.text(`Order Date: ${orderDate}`, MARGIN, y + 14);
  doc.text(`Terms: ${terms}`, MARGIN, y + 28);
  doc.text(`Shipping Type: ${shippingType}`, MARGIN, y + 42);

  const shipToLines = [];
  if (invoice.customer_name) shipToLines.push(invoice.customer_name);
  if (invoice.customer_address) shipToLines.push(invoice.customer_address);
  if (invoice.customer_phone && !invoice.customer_address) shipToLines.push(invoice.customer_phone);
  if (invoice.customer_email) shipToLines.push(invoice.customer_email);
  const shipToText = shipToLines.length ? shipToLines.join(', ') : '—';
  doc.fillColor(GRAY_HEADER);
  doc.font('Helvetica-Bold');
  doc.text('Ship To', PAGE_WIDTH - MARGIN - 220, y, { width: 220, align: 'right' });
  doc.font('Helvetica');
  doc.fillColor('black');
  doc.fontSize(9);
  doc.text(shipToText, PAGE_WIDTH - MARGIN - 220, y + 12, { width: 220, align: 'right' });

  y += 56;
  doc.strokeColor(BORDER_GRAY);
  doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).stroke();
  doc.strokeColor('black');
  y += 16;

  // ----- Order Items table -----
  doc.fillColor(TEAL);
  doc.fontSize(12);
  doc.font('Helvetica-Bold');
  doc.text('Order Items', MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
  doc.fillColor('black');
  doc.font('Helvetica');
  y += 18;

  // Wider product-name column, no promo discount column
  const colQty = MARGIN;
  const colId = colQty + 32;
  const colName = colId + 60;
  const colUnitCost = PAGE_WIDTH - MARGIN - 140;
  const colTotalCost = PAGE_WIDTH - MARGIN - 60;
  doc.fillColor(LIGHT_BG);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 18).fill();
  doc.strokeColor(BORDER_GRAY);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 18).stroke();
  doc.fillColor('black');
  doc.strokeColor('black');
  doc.fillColor(GRAY_HEADER);
  doc.fontSize(9);
  doc.font('Helvetica-Bold');
  doc.text('Qty', colQty + 4, y + 5);
  doc.text('Item ID', colId, y + 5);
  doc.text('Product Name', colName, y + 5);
  doc.text('Unit price', colUnitCost, y + 5, { width: 60, align: 'right' });
  doc.text('Amount', colTotalCost, y + 5, { width: 60, align: 'right' });
  doc.fillColor('black');
  doc.font('Helvetica');
  y += 20;

  const itemTotal = items.reduce((sum: number, i: any) => sum + parseFloat(i.subtotal || 0), 0);
  const discountAmount = invoice.discount_amount ?? 0;
  const taxAmount = invoice.tax_amount ?? 0;
  const adjustment = invoice.adjustment ?? 0;

  items.forEach((item: any, idx: number) => {
    const pid = item.product_id ? String(item.product_id) : '';
    const itemId = skuMap[pid] || item.sku || (pid ? pid : '—');
    const name = item.product_name || 'Product';
    if (idx > 0) doc.strokeColor(BORDER_GRAY).moveTo(MARGIN, y - 2).lineTo(PAGE_WIDTH - MARGIN, y - 2).stroke().strokeColor('black');
    doc.fontSize(9);
    doc.text(String(item.quantity ?? 0), colQty + 4, y);
    doc.text(String(itemId).slice(0, 20), colId, y, { width: 52 });
    doc.text(name, colName, y, { width: colUnitCost - colName - 12 });
    doc.text(parseFloat(item.price || 0).toFixed(2), colUnitCost, y, { width: 60, align: 'right' });
    doc.text(parseFloat(item.subtotal || 0).toFixed(2), colTotalCost, y, { width: 60, align: 'right' });
    y += 16;
  });

  y += 10;

  // ----- Summary box (teal border, light background) -----
  const summaryX = PAGE_WIDTH - MARGIN - 180;
  const summaryY = y;
  doc.fillColor('#f0fdfa');
  doc.rect(summaryX - 10, summaryY - 6, 200, 84).fill();
  doc.strokeColor(TEAL);
  doc.rect(summaryX - 10, summaryY - 6, 200, 84).stroke();
  doc.fillColor('black');
  doc.strokeColor('black');
  doc.fillColor(GRAY_HEADER);
  doc.fontSize(9);
  doc.font('Helvetica');
  doc.text('Item Total', summaryX, y, { width: 90, align: 'right' });
  doc.fillColor('black');
  doc.text(itemTotal.toFixed(2), summaryX + 90, y, { width: 90, align: 'right' });
  y += 14;
  doc.fillColor(GRAY_HEADER);
  doc.text('Tax', summaryX, y, { width: 90, align: 'right' });
  doc.fillColor('black');
  doc.text(taxAmount.toFixed(2), summaryX + 90, y, { width: 90, align: 'right' });
  y += 14;
  doc.fillColor(GRAY_HEADER);
  doc.text('Adjustment', summaryX, y, { width: 90, align: 'right' });
  doc.fillColor('black');
  doc.text(adjustment.toFixed(2), summaryX + 90, y, { width: 90, align: 'right' });
  y += 18;
  doc.fillColor(TEAL);
  doc.font('Helvetica-Bold');
  doc.fontSize(12);
  doc.text('Grand Total', summaryX, y, { width: 90, align: 'right' });
  doc.fillColor('black');
  doc.text(parseFloat(invoice.total_amount || 0).toFixed(2), summaryX + 90, y, { width: 90, align: 'right' });
  doc.font('Helvetica');
  y += 16;

  doc.fontSize(8);
  doc.fillColor('#9ca3af');
  doc.text('Page 1/1', MARGIN, PAGE_HEIGHT - MARGIN - 12);

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(filepath));
    doc.on('error', reject);
  });
};

// Summary: total paid = sum(amount_paid), total unpaid = sum(total_amount - amount_paid) so timeline matches table
router.get('/summary', authenticateAdmin, async (_req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const unpaidGroup = { $group: { _id: null as unknown, total: { $sum: { $subtract: ['$total_amount', { $ifNull: ['$amount_paid', 0] }] } } } };
    const [paidResult, unpaidResult, overdueResult, paidCountResult, unpaidCountResult, overdueCountResult, recentlyPaidResult] = await Promise.all([
      Invoice.aggregate([{ $group: { _id: null, total: { $sum: { $ifNull: ['$amount_paid', 0] } } } }]),
      Invoice.aggregate([{ $project: { balance: { $subtract: ['$total_amount', { $ifNull: ['$amount_paid', 0] }] } } }, { $match: { balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
      Invoice.aggregate([{ $match: { due_date: { $lt: now } } }, { $project: { balance: { $subtract: ['$total_amount', { $ifNull: ['$amount_paid', 0] }] } } }, { $match: { balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]),
      Invoice.countDocuments({ $expr: { $gte: [{ $ifNull: ['$amount_paid', 0] }, '$total_amount'] } }),
      Invoice.countDocuments({ $expr: { $lt: [{ $ifNull: ['$amount_paid', 0] }, '$total_amount'] } }),
      Invoice.countDocuments({ due_date: { $lt: now }, $expr: { $lt: [{ $ifNull: ['$amount_paid', 0] }, '$total_amount'] } }),
      Invoice.aggregate([{ $match: { updated_at: { $gte: thirtyDaysAgo } } }, { $group: { _id: null, total: { $sum: { $ifNull: ['$amount_paid', 0] } } } }]),
    ]);
    const totalPaid = paidResult[0]?.total ?? 0;
    const totalUnpaid = unpaidResult[0]?.total ?? 0;
    const overdueTotal = overdueResult[0]?.total ?? 0;
    const openTotal = totalUnpaid;
    const openCount = unpaidCountResult ?? 0;
    const overdueCount = overdueCountResult ?? 0;
    const paidCount = paidCountResult ?? 0;
    const recentlyPaidTotal = recentlyPaidResult[0]?.total ?? 0;
    res.json({
      totalPaid,
      totalUnpaid,
      overdueTotal,
      overdueCount,
      openTotal,
      openCount,
      paidCount,
      recentlyPaidTotal,
    });
  } catch (error) {
    console.error('Invoices summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get invoices
router.get('/', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { page = 1, limit = 50, search, customer_id, unpaid_only, type: docType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let query: any = {};

    if (search) {
      query.$or = [
        { invoice_number: { $regex: search, $options: 'i' } },
        { customer_name: { $regex: search, $options: 'i' } },
        { customer_phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (customer_id && typeof customer_id === 'string') {
      query.customer_id = new mongoose.Types.ObjectId(customer_id);
    }
    if (unpaid_only === 'true' || unpaid_only === '1') {
      query.payment_status = 'unpaid';
    }
    if (docType === 'invoice' || docType === 'quotation') {
      query.invoice_type = docType;
    }

    const invoices = await Invoice.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Invoice.countDocuments(query);

    res.json(
      invoices.map((invoice: any) => ({
        id: invoice._id.toString(),
        invoice_number: invoice.invoice_number,
        invoice_type: invoice.invoice_type,
        customer_id: invoice.customer_id?.toString(),
        customer_name: invoice.customer_name,
        customer_phone: invoice.customer_phone,
        customer_email: invoice.customer_email,
        customer_address: invoice.customer_address,
        total_amount: invoice.total_amount,
        amount_paid: invoice.amount_paid ?? 0,
        tax_amount: invoice.tax_amount || 0,
        payment_method: invoice.payment_method,
        payment_status: invoice.payment_status,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        created_at: invoice.created_at,
        items: invoice.items || [],
      }))
    );
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get next document number: INV#001, INV#002, ... or QTN#001, QTN#002, ...
async function getNextInvoiceNumber(): Promise<string> {
  const docs = await Invoice.find({ invoice_number: /^INV#\d+$/ }).sort({ invoice_number: -1 }).limit(1).lean();
  if (docs.length === 0) return 'INV#001';
  const last = (docs[0] as any).invoice_number;
  const num = parseInt(last.replace(/^INV#/, ''), 10) || 0;
  return `INV#${String(num + 1).padStart(3, '0')}`;
}
async function getNextQuotationNumber(): Promise<string> {
  const docs = await Invoice.find({ invoice_number: /^QTN#\d+$/ }).sort({ invoice_number: -1 }).limit(1).lean();
  if (docs.length === 0) return 'QTN#001';
  const last = (docs[0] as any).invoice_number;
  const num = parseInt(last.replace(/^QTN#/, ''), 10) || 0;
  return `QTN#${String(num + 1).padStart(3, '0')}`;
}

// Generate next invoice or quotation number (for create form)
router.get('/generate-number', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const type = (req.query.type as string) || 'invoice';
    const number = type === 'quotation' ? await getNextQuotationNumber() : await getNextInvoiceNumber();
    res.json({ invoice_number: number });
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate number' });
  }
});

// Get customer-specific last prices for all products
router.get('/customer-prices/:customerId', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { customerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.json({});
    }
    const prices = await CustomerProductPrice.find({ customer_id: new mongoose.Types.ObjectId(customerId) }).lean();
    const priceMap: Record<string, number> = {};
    for (const p of prices) {
      priceMap[(p as any).product_id.toString()] = (p as any).last_price;
    }
    res.json(priceMap);
  } catch (error) {
    console.error('Fetch customer prices error:', error);
    res.status(500).json({ error: 'Failed to fetch customer prices' });
  }
});

// Create manual invoice or quotation (saved as unpaid)
router.post('/', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body as any;
    const docType = body.invoice_type === 'quotation' ? 'quotation' : 'invoice';
    const invoice_number = body.invoice_number || (docType === 'quotation' ? await getNextQuotationNumber() : await getNextInvoiceNumber());
    const invoice_date = body.invoice_date ? new Date(body.invoice_date) : new Date();
    const due_date = body.due_date ? new Date(body.due_date) : invoice_date;
    const customer_id = body.customer_id ? new mongoose.Types.ObjectId(body.customer_id) : undefined;
    const items = (body.items || []).map((i: any) => ({
      product_id: i.product_id ? new mongoose.Types.ObjectId(i.product_id) : undefined,
      product_name: i.product_name || '',
      category_name: i.category_name,
      quantity: Number(i.quantity) || 0,
      price: Number(i.price) || 0,
      subtotal: Number(i.subtotal) || 0,
    }));
    const subtotal_amount = items.reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
    const tax_amount = Number(body.tax_amount) || 0;
    const total_amount = subtotal_amount + tax_amount;

    // Prevent negative stock: block when out of stock so inventory never goes below zero
    for (const item of items) {
      if (!item.product_id || (item.quantity || 0) <= 0) continue;
      const product = await Product.findById(item.product_id);
      if (!product) continue;
      if ((product as any).product_type === 'service' || (product as any).product_type === 'non_inventory') continue;
      const qty = Number(item.quantity) || 0;
      const currentQty = (product as any).stock_quantity ?? 0;
      if (currentQty - qty < 0) {
        return res.status(400).json({ error: `Product "${product.name}" is out of stock. Please restock before invoicing.` });
      }
    }

    const inv = await Invoice.create({
      invoice_number,
      customer_id,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      customer_email: body.customer_email,
      customer_address: body.customer_address,
      location_of_sale: body.location_of_sale || LOCATION_OF_SALE,
      invoice_type: body.invoice_type || 'invoice',
      invoice_date,
      due_date,
      subtotal_amount,
      tax_amount,
      total_amount,
      amount_paid: 0,
      terms: body.terms,
      payment_status: 'unpaid',
      items,
    });
    // Decrement stock for inventory products (safe: we already validated non-negative above)
    for (const item of items) {
      if (!item.product_id || (item.quantity || 0) <= 0) continue;
      const product = await Product.findById(item.product_id);
      if (!product) continue;
      if ((product as any).product_type === 'service' || (product as any).product_type === 'non_inventory') continue;
      const qty = Number(item.quantity) || 0;
      await Product.findByIdAndUpdate(item.product_id, { $inc: { stock_quantity: -qty } });
    }

    await saveCustomerProductPrices(customer_id as any, items, inv._id, invoice_date);

    const doc = inv.toObject();
    res.status(201).json({
      id: (doc as any)._id.toString(),
      invoice_number: (doc as any).invoice_number,
      customer_id: (doc as any).customer_id?.toString(),
      total_amount: (doc as any).total_amount,
      payment_status: (doc as any).payment_status,
      created_at: (doc as any).created_at,
    });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Generate and download invoice PDF (must be before GET /:id so /:id/pdf is matched)
router.get('/:id/pdf', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const items = invoice.items || [];
    const productIds = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))];
    const products = productIds.length ? await Product.find({ _id: { $in: productIds } }).select('sku').lean() : [];
    const skuMap: Record<string, string> = {};
    products.forEach((p: any) => { skuMap[p._id.toString()] = p.sku || p._id.toString(); });
    const filepath = await generateInvoicePDF(invoice, items, skuMap);

    if (!invoice.pdf_path) {
      await Invoice.findByIdAndUpdate(req.params.id, { pdf_path: filepath });
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.download(filepath);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get invoice by ID
router.get('/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const doc = invoice as any;
    res.json({
      id: doc._id.toString(),
      invoice_number: doc.invoice_number,
      customer_id: doc.customer_id?.toString(),
      customer_name: doc.customer_name,
      customer_phone: doc.customer_phone,
      customer_email: doc.customer_email,
      customer_address: doc.customer_address,
      location_of_sale: doc.location_of_sale,
      invoice_type: doc.invoice_type,
      invoice_date: doc.invoice_date,
      due_date: doc.due_date,
      total_amount: doc.total_amount,
      subtotal_amount: doc.subtotal_amount,
      tax_amount: doc.tax_amount,
      amount_paid: doc.amount_paid ?? 0,
      terms: doc.terms,
      payment_status: doc.payment_status,
      items: doc.items || [],
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Update invoice (e.g. edit draft / unpaid)
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const body = req.body as any;
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    if (body.invoice_date !== undefined) invoice.invoice_date = new Date(body.invoice_date);
    if (body.invoice_type !== undefined) invoice.invoice_type = body.invoice_type;
    if (body.customer_id !== undefined) invoice.customer_id = body.customer_id ? new mongoose.Types.ObjectId(body.customer_id) : undefined;
    if (body.customer_name !== undefined) invoice.customer_name = body.customer_name;
    if (body.customer_phone !== undefined) invoice.customer_phone = body.customer_phone;
    if (body.customer_email !== undefined) invoice.customer_email = body.customer_email;
    if (body.customer_address !== undefined) invoice.customer_address = body.customer_address;
    if (body.terms !== undefined) invoice.terms = body.terms;
    if (body.items !== undefined) {
      const items = body.items.map((i: any) => ({
        product_id: i.product_id ? new mongoose.Types.ObjectId(i.product_id) : undefined,
        product_name: i.product_name || '',
        category_name: i.category_name,
        quantity: Number(i.quantity) || 0,
        price: Number(i.price) || 0,
        subtotal: Number(i.subtotal) || 0,
      }));

      // Return stock for old invoice items (inventory products only)
      const oldItems = (invoice as any).items || [];
      for (const item of oldItems) {
        if (!item.product_id || (item.quantity || 0) <= 0) continue;
        const product = await Product.findById(item.product_id).lean();
        if (!product) continue;
        const p = product as any;
        if (p.product_type === 'service' || p.product_type === 'non_inventory') continue;
        await Product.findByIdAndUpdate(item.product_id, { $inc: { stock_quantity: Number(item.quantity) || 0 } });
      }

      // Decrement stock for new items (allows negative stock)
      for (const item of items) {
        if (!item.product_id || (item.quantity || 0) <= 0) continue;
        const product = await Product.findById(item.product_id);
        if (!product) continue;
        if ((product as any).product_type === 'service' || (product as any).product_type === 'non_inventory') continue;
        await Product.findByIdAndUpdate(item.product_id, { $inc: { stock_quantity: -(Number(item.quantity) || 0) } });
      }

      invoice.items = items;
      const subtotal_amount = items.reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
      invoice.subtotal_amount = subtotal_amount;
      invoice.tax_amount = Number(body.tax_amount) ?? invoice.tax_amount;
      invoice.total_amount = subtotal_amount + invoice.tax_amount;
    }
    // Never overwrite amount_paid on edit. Recompute payment_status from actual amount_paid vs total.
    const paid = invoice.amount_paid ?? 0;
    const total = invoice.total_amount ?? 0;
    invoice.payment_status = paid >= total ? 'paid' : 'unpaid';
    await invoice.save();

    if (invoice.customer_id && invoice.items?.length) {
      await saveCustomerProductPrices(invoice.customer_id, invoice.items, invoice._id, invoice.invoice_date || new Date());
    }

    const doc = invoice.toObject();
    res.json({
      id: (doc as any)._id.toString(),
      invoice_number: (doc as any).invoice_number,
      payment_status: (doc as any).payment_status,
    });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Receive payment: apply amount to one or more invoices, update amount_paid and payment_status, create Receipt
router.post('/receive-payment', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { amount_received, payment_date, payment_method, reference_no, deposit_to, bank_account_id, allocations } = req.body as {
      amount_received: number;
      payment_date?: string;
      payment_method?: string;
      reference_no?: string;
      deposit_to?: string;
      bank_account_id?: string;
      allocations: { invoice_id: string; amount: number }[];
    };
    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ error: 'allocations (invoice_id, amount) required' });
    }
    // Bank account is optional; payment is recorded and invoices updated either way.
    const bankId = bank_account_id || deposit_to || undefined;
    const totalAlloc = allocations.reduce((s, a) => s + Number(a.amount || 0), 0);
    const amount = Number(amount_received) || totalAlloc;
    const pmtDate = payment_date ? new Date(payment_date) : new Date();

    const invoiceIds: string[] = [];
    const customerName: string[] = [];
    let firstCustomerId: mongoose.Types.ObjectId | null = null;
    for (const { invoice_id, amount: amt } of allocations) {
      const a = Number(amt);
      if (a <= 0) continue;
      const inv = await Invoice.findById(invoice_id);
      if (!inv) continue;
      if (!firstCustomerId && (inv as any).customer_id) firstCustomerId = (inv as any).customer_id;
      const paid = (inv.amount_paid ?? 0) + a;
      inv.amount_paid = paid;
      inv.payment_status = paid >= (inv.total_amount || 0) ? 'paid' : 'unpaid';
      await inv.save();
      invoiceIds.push(inv.invoice_number);
      if (inv.customer_name) customerName.push(inv.customer_name);
    }
    const trxId = 'RT' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).substring(2, 5).toUpperCase();
    await Receipt.create({
      trx_id: trxId,
      trx_date: pmtDate,
      customer_id: firstCustomerId || undefined,
      customer_name: customerName[0] || 'Customer',
      invoice_num: invoiceIds.join(', '),
      pmt_mode: payment_method || 'Other',
      amount_received: amount,
      ...(bankId ? { bank_account_id: bankId } : {}),
    });

    res.json({ success: true, message: 'Payment recorded', trx_id: trxId });
  } catch (error) {
    console.error('Receive payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Send invoice via email
router.post('/:id/send-email', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).lean();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice.customer_email) {
      return res.status(400).json({ error: 'Customer email not found' });
    }

    const items = invoice.items || [];
    const productIds = [...new Set((items || []).map((i: any) => i.product_id).filter(Boolean))];
    const products = productIds.length ? await Product.find({ _id: { $in: productIds } }).select('sku').lean() : [];
    const skuMap: Record<string, string> = {};
    products.forEach((p: any) => { skuMap[p._id.toString()] = p.sku || p._id.toString(); });

    let filepath = invoice.pdf_path;
    if (!filepath || !fs.existsSync(filepath)) {
      filepath = await generateInvoicePDF(invoice, items, skuMap);
      await Invoice.findByIdAndUpdate(req.params.id, { pdf_path: filepath });
    }

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: invoice.customer_email,
      subject: `Invoice ${invoice.invoice_number} - Express Distributors Inc`,
      text: `Please find attached your invoice ${invoice.invoice_number}.`,
      attachments: [
        {
          filename: `invoice-${invoice.invoice_number}.pdf`,
          path: filepath,
        },
      ],
    });

    await Invoice.findByIdAndUpdate(req.params.id, { email_sent: true });

    res.json({ message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
});

export default router;
