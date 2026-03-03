import express from 'express';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import PurchaseOrder from '../models/PurchaseOrder';
import Product from '../models/Product';
import StockMovement from '../models/StockMovement';
import Vendor from '../models/Vendor';
import StoreSettings from '../models/StoreSettings';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { postVendorLedger } from '../modules/vendors/services/vendorLedgerService';
import { LedgerReferenceType } from '../shared/enums';

const router = express.Router();
const MARGIN = 50;
const PAGE_WIDTH = 595;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TEAL = '#0f766e';

async function generatePOPDF(po: any): Promise<string> {
  const uploadsDir = path.join(__dirname, '../../uploads/purchase-orders');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `po-${po.po_number || po._id}.pdf`;
  const filepath = path.join(uploadsDir, filename);
  if (fs.existsSync(filepath)) {
    try { fs.unlinkSync(filepath); } catch (_) {}
  }
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  const stream = fs.createWriteStream(filepath);
  doc.pipe(stream);
  const settings = await StoreSettings.findOne().lean().catch(() => null) as any;
  const businessName = settings?.business_name || 'Express Distributors Inc';
  let y = MARGIN;
  doc.fillColor(TEAL);
  doc.fontSize(18);
  doc.font('Helvetica-Bold');
  doc.text(businessName, MARGIN, y);
  doc.fillColor('black');
  doc.font('Helvetica');
  y += 28;
  doc.fontSize(14);
  doc.text('PURCHASE ORDER', MARGIN, y);
  y += 22;
  doc.fontSize(10);
  const poNumber = po.po_number || po._id?.toString() || '—';
  const vendorName = (po.vendor_id as any)?.name ?? po.vendor_id ?? '—';
  const created = po.created_at ? new Date(po.created_at).toLocaleDateString('en-US') : '—';
  doc.text(`PO Number: ${poNumber}`, MARGIN, y);
  doc.text(`Vendor: ${vendorName}`, MARGIN, y + 14);
  doc.text(`Date: ${created}`, MARGIN, y + 28);
  y += 50;
  doc.fontSize(10);
  doc.font('Helvetica-Bold');
  const colName = MARGIN;
  const colQty = colName + 220;
  const colCost = colQty + 60;
  const colTotal = colCost + 80;
  doc.text('Product', colName, y);
  doc.text('Qty', colQty, y);
  doc.text('Unit Cost', colCost, y);
  doc.text('Subtotal', colTotal, y);
  doc.font('Helvetica');
  y += 18;
  const items = po.items || [];
  for (const item of items) {
    const name = item.product_name || '—';
    const qty = item.quantity_ordered ?? 0;
    const cost = item.unit_cost ?? 0;
    const subtotal = (item.subtotal ?? (qty * cost));
    doc.text(name.substring(0, 35), colName, y);
    doc.text(String(qty), colQty, y);
    doc.text(Number(cost).toFixed(2), colCost, y);
    doc.text(Number(subtotal).toFixed(2), colTotal, y);
    y += 18;
  }
  y += 10;
  doc.font('Helvetica-Bold');
  doc.text(`Subtotal: ${Number(po.subtotal ?? 0).toFixed(2)}`, MARGIN, y);
  doc.text(`Tax: ${Number(po.tax_amount ?? 0).toFixed(2)}`, MARGIN, y + 14);
  doc.text(`Total: ${Number(po.total_amount ?? 0).toFixed(2)}`, MARGIN, y + 28);
  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  return filepath;
}

const generatePONumber = () => `P${String(Math.floor(10000 + Math.random() * 90000))}`;

router.get('/generate-id', authenticateAdmin, (req, res) => {
  res.json({ po_number: generatePONumber() });
});

// List purchase orders
router.get('/', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { status, vendor_id, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    let query: any = {};
    if (status) query.status = status;
    if (vendor_id) query.vendor_id = vendor_id;
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(query).populate('vendor_id', 'name contact_name phone state city supplier_id').sort({ created_at: -1 }).skip(skip).limit(Number(limit)).lean(),
      PurchaseOrder.countDocuments(query),
    ]);
    res.json({
      purchase_orders: (pos as any[]).map((po) => ({
        id: po._id.toString(),
        po_number: po.po_number,
        vendor_id: po.vendor_id?._id?.toString(),
        vendor_name: po.vendor_id?.name,
        supplier_id: po.vendor_id?.supplier_id,
        state: po.vendor_id?.state,
        city: po.vendor_id?.city,
        status: po.status,
        items: po.items,
        subtotal: po.subtotal,
        tax_amount: po.tax_amount,
        total_amount: po.total_amount,
        expected_date: po.expected_date,
        received_at: po.received_at,
        notes: po.notes,
        created_at: po.created_at,
      })),
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    console.error('List POs error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// PO PDF (must be before GET /:id)
router.get('/:id/pdf', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('vendor_id').lean();
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const filepath = await generatePOPDF(po);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.download(filepath);
  } catch (error) {
    console.error('PO PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get one PO
router.get('/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id).populate('vendor_id').populate('items.product_id', 'name sku barcode').lean();
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const p = po as any;
    res.json({
      id: p._id.toString(),
      po_number: p.po_number,
      vendor_id: p.vendor_id?._id?.toString(),
      vendor: p.vendor_id,
      status: p.status,
      items: p.items,
      subtotal: p.subtotal,
      tax_amount: p.tax_amount,
      total_amount: p.total_amount,
      expected_date: p.expected_date,
      received_at: p.received_at,
      notes: p.notes,
      created_at: p.created_at,
    });
  } catch (error) {
    console.error('Get PO error:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Create PO
router.post('/', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      po_number: z.string().optional(),
      vendor_id: z.string(),
      items: z.array(
        z.object({
          product_id: z.string(),
          product_name: z.string(),
          quantity_ordered: z.number().int().positive(),
          unit_cost: z.number().min(0),
        })
      ),
      tax_amount: z.number().min(0).optional(),
      expected_date: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const vendor = await Vendor.findById(data.vendor_id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

    const items = data.items.map((item) => {
      const subtotal = item.quantity_ordered * item.unit_cost;
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost,
        subtotal,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const tax_amount = data.tax_amount ?? 0;
    const total_amount = subtotal + tax_amount;

    const po = await PurchaseOrder.create({
      po_number: data.po_number || generatePONumber(),
      vendor_id: data.vendor_id,
      status: 'draft',
      items,
      subtotal,
      tax_amount,
      total_amount,
      expected_date: data.expected_date ? new Date(data.expected_date) : undefined,
      notes: data.notes,
      created_by: req.userId,
    });
    // Update each product's cost_price to this PO's unit cost (so inventory reflects latest purchase cost)
    for (const item of items) {
      if (item.product_id) await Product.findByIdAndUpdate(item.product_id, { $set: { cost_price: item.unit_cost } });
    }
    res.status(201).json({
      id: po._id.toString(),
      po_number: po.po_number,
      vendor_id: po.vendor_id,
      status: po.status,
      items: po.items,
      subtotal: po.subtotal,
      tax_amount: po.tax_amount,
      total_amount: po.total_amount,
      created_at: po.created_at,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('Create PO error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Update PO (draft only: items, notes)
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status !== 'draft') return res.status(400).json({ error: 'Can only edit draft POs' });

    const schema = z.object({
      items: z
        .array(
          z.object({
            product_id: z.string(),
            product_name: z.string(),
            quantity_ordered: z.number().int().positive(),
            unit_cost: z.number().min(0),
          })
        )
        .optional(),
      tax_amount: z.number().min(0).optional(),
      expected_date: z.string().optional(),
      notes: z.string().optional(),
    });
    const data = schema.parse(req.body);
    if (data.items) {
      const items = data.items.map((item) => ({
        product_id: new mongoose.Types.ObjectId(item.product_id),
        product_name: item.product_name,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost,
        subtotal: item.quantity_ordered * item.unit_cost,
      }));
      po.items = items;
      po.subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    }
    if (data.tax_amount !== undefined) po.tax_amount = data.tax_amount;
    if (data.expected_date !== undefined) po.expected_date = data.expected_date ? new Date(data.expected_date) : undefined;
    if (data.notes !== undefined) po.notes = data.notes;
    po.total_amount = po.subtotal + po.tax_amount;
    await po.save();
    // Update each product's cost_price to this PO's unit cost
    for (const line of po.items) {
      const pid = (line as any).product_id;
      if (pid) await Product.findByIdAndUpdate(pid, { $set: { cost_price: (line as any).unit_cost } });
    }
    res.json({ id: po._id.toString(), ...po.toObject() });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('Update PO error:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// Mark PO as sent
router.post('/:id/send', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status: 'sent' }, { new: true });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ id: po._id.toString(), status: po.status });
  } catch (error) {
    console.error('Send PO error:', error);
    res.status(500).json({ error: 'Failed to update PO' });
  }
});

// Receive PO (full or partial) - updates stock
router.post('/:id/receive', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      items: z.array(
        z.object({
          product_id: z.string(),
          quantity_received: z.number().int().min(0),
        })
      ),
    });
    const { items: receivedItems } = schema.parse(req.body);
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'cancelled') return res.status(400).json({ error: 'PO is cancelled' });

    for (const rec of receivedItems) {
      const line = po.items.find((i: any) => i.product_id.toString() === rec.product_id);
      if (!line) continue;
      const qty = Math.min(rec.quantity_received, line.quantity_ordered - line.quantity_received);
      if (qty <= 0) continue;
      line.quantity_received += qty;
      await Product.findByIdAndUpdate(rec.product_id, { $inc: { stock_quantity: qty } });
      await StockMovement.create({
        product_id: rec.product_id,
        movement_type: 'purchase',
        quantity_change: qty,
        reference_type: 'purchase_order',
        reference_id: po._id,
        admin_id: req.userId,
      });
    }
    const allReceived = po.items.every((i: any) => i.quantity_received >= i.quantity_ordered);
    po.status = allReceived ? 'received' : 'partial';
    if (allReceived) po.received_at = new Date();
    await po.save();

    // Post vendor ledger on full receive: DR VENDOR (increase payable), CR PURCHASE
    if (allReceived && po.total_amount > 0) {
      await postVendorLedger(
        po.vendor_id,
        [
          { account_type: 'VENDOR', debit: po.total_amount, credit: 0, reference_type: LedgerReferenceType.PURCHASE_ORDER, reference_id: po._id, description: `PO ${po.po_number} received` },
          { account_type: 'PURCHASE', debit: 0, credit: po.total_amount, reference_type: LedgerReferenceType.PURCHASE_ORDER, reference_id: po._id, description: `PO ${po.po_number}` },
        ],
        req.userId ? new mongoose.Types.ObjectId(req.userId) : undefined
      );
    }

    res.json({ id: po._id.toString(), status: po.status, items: po.items });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('Receive PO error:', error);
    res.status(500).json({ error: 'Failed to receive PO' });
  }
});

// Cancel PO
router.post('/:id/cancel', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const po = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ id: po._id.toString(), status: po.status });
  } catch (error) {
    console.error('Cancel PO error:', error);
    res.status(500).json({ error: 'Failed to cancel PO' });
  }
});

export default router;
