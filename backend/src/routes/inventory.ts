import express from 'express';
import Product from '../models/Product';
import StockMovement from '../models/StockMovement';
import AuditLog from '../models/AuditLog';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// Inventory summary: total in/out per product
router.get('/summary', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const agg = await StockMovement.aggregate([
      {
        $group: {
          _id: '$product_id',
          in_qty: {
            $sum: {
              $cond: [{ $gt: ['$quantity_change', 0] }, '$quantity_change', 0],
            },
          },
          out_qty: {
            $sum: {
              $cond: [{ $lt: ['$quantity_change', 0] }, { $multiply: ['$quantity_change', -1] }, 0],
            },
          },
        },
      },
    ]);
    const summary: Record<string, { in: number; out: number }> = {};
    for (const row of agg) {
      summary[String(row._id)] = { in: row.in_qty || 0, out: row.out_qty || 0 };
    }
    res.json({ summary });
  } catch (error) {
    console.error('Inventory summary error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

// Adjust stock (manual adjustment)
router.post('/adjust', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      product_id: z.string(),
      quantity_change: z.number().int(), // positive = add, negative = remove
      notes: z.string().optional(),
    });
    const { product_id, quantity_change, notes } = schema.parse(req.body);
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const oldQty = product.stock_quantity;
    const newQty = oldQty + quantity_change;
    if (newQty < 0) return res.status(400).json({ error: 'Resulting stock cannot be negative' });
    await Product.findByIdAndUpdate(product_id, { stock_quantity: newQty });
    await StockMovement.create({
      product_id,
      movement_type: 'adjustment',
      quantity_change,
      notes: notes || undefined,
      admin_id: req.userId,
    });
    await AuditLog.create({
      admin_id: req.userId,
      action: 'stock_adjust',
      entity_type: 'Product',
      entity_id: product_id,
      old_value: { stock_quantity: oldQty },
      new_value: { stock_quantity: newQty },
      details: notes || `Stock adjusted by ${quantity_change >= 0 ? '+' : ''}${quantity_change}`,
    });
    const updated = await Product.findById(product_id).lean();
    res.json({
      id: updated!._id.toString(),
      stock_quantity: (updated as any).stock_quantity,
      message: `Stock adjusted by ${quantity_change >= 0 ? '+' : ''}${quantity_change}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

// Get stock movements for a product
router.get('/movements/:productId', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const { productId } = req.params;
    const { limit = 50 } = req.query;
    const movements = await StockMovement.find({ product_id: productId })
      .sort({ created_at: -1 })
      .limit(Number(limit))
      .lean();
    res.json({
      movements: movements.map((m: any) => ({
        id: m._id.toString(),
        movement_type: m.movement_type,
        quantity_change: m.quantity_change,
        reference_type: m.reference_type,
        notes: m.notes,
        created_at: m.created_at,
      })),
    });
  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({ error: 'Failed to fetch movements' });
  }
});

export default router;
