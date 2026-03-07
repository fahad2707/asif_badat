import express from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import Product from '../models/Product';
import Category from '../models/Category';
import { authenticateAdmin, AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import { buildPreview, executeImport } from '../services/productImportService';

const router = express.Router();

/** Only return an ObjectId if the string is a valid 24-char hex; otherwise undefined (avoids Mongoose throw). */
function toObjectIdOrUndefined(id: string | undefined): mongoose.Types.ObjectId | undefined {
  if (!id || typeof id !== 'string' || id.length !== 24) return undefined;
  if (!/^[a-f0-9A-F]{24}$/.test(id)) return undefined;
  return new mongoose.Types.ObjectId(id);
}

async function generateItemId(): Promise<string> {
  const ProductModel = Product;
  for (let i = 0; i < 20; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await ProductModel.findOne({ sku: id });
    if (!exists) return id;
  }
  return String(Date.now() % 1000000).padStart(6, '0');
}

router.get('/generate-id', authenticateAdmin, async (req, res) => {
  const item_id = await generateItemId();
  res.json({ item_id });
});

// Multer for CSV upload (memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/csv' || file.originalname?.toLowerCase().endsWith('.csv');
    if (ok) cb(null, true);
    else cb(new Error('Only CSV files are allowed'));
  },
});

// Get all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, category_id: categoryIdParam, sub_category_id: subCategoryIdParam, search, page = 1, limit } = req.query;
    const limitNum = Math.min(Math.max(Number(limit) || 100, 1), 5000);
    const pageNum = Math.max(Number(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;

    let query: any = { is_active: true };

    // Filter by category slug (store) or category_id / sub_category_id (admin catalog)
    if (categoryIdParam && typeof categoryIdParam === 'string') {
      query.category_id = categoryIdParam;
    } else if (subCategoryIdParam && typeof subCategoryIdParam === 'string') {
      query.sub_category_id = subCategoryIdParam;
    } else if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        query.category_id = categoryDoc._id;
      } else {
        return res.json({ products: [], pagination: { page: 1, limit: limitNum, total: 0, totalPages: 0 } });
      }
    }

    // Search filter (name, description, sku, barcode)
    if (search) {
      const searchStr = String(search).trim();
      query.$or = [
        { name: { $regex: searchStr, $options: 'i' } },
        { description: { $regex: searchStr, $options: 'i' } },
        { sku: searchStr },
        { barcode: searchStr },
      ];
    }

    const products = await Product.find(query)
      .populate('category_id', 'name slug')
      .populate('sub_category_id', 'name slug')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Product.countDocuments(query);

    // Format products (available = on-hand − committed)
    const formattedProducts = products.map((product: any) => {
      const onHand = product.stock_quantity ?? 0;
      const committed = product.committed_quantity ?? 0;
      return {
        id: product._id.toString(),
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        product_type: product.product_type || 'inventory',
        price: product.price,
        cost_price: product.cost_price != null ? Number(product.cost_price) : null,
        category_id: product.category_id?._id?.toString(),
        category_name: product.category_id?.name,
        category_slug: product.category_id?.slug,
        sub_category_id: product.sub_category_id?._id?.toString(),
        sub_category_name: product.sub_category_id?.name,
        image_url: product.image_url,
        barcode: product.barcode,
        stock_quantity: onHand,
        committed_quantity: committed,
        available_quantity: onHand - committed,
        low_stock_threshold: product.low_stock_threshold,
        is_active: product.is_active,
        created_at: product.created_at,
      };
    });

    res.json({
      products: formattedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get product by barcode or SKU (for POS / scanner) — must be before GET /:id
router.get('/barcode/:barcode', authenticateAdmin, async (req, res) => {
  try {
    const code = req.params.barcode?.trim() || '';
    let product = await Product.findOne({ barcode: code, is_active: true }).populate('category_id', 'name slug').lean();
    if (!product) {
      product = await Product.findOne({ sku: code, is_active: true }).populate('category_id', 'name slug').lean();
    }
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const p = product as any;
    res.json({
      id: p._id.toString(),
      name: p.name,
      price: p.price ?? 0,
      cost_price: p.cost_price != null ? Number(p.cost_price) : null,
      category_name: p.category_id?.name ?? '',
      sku: p.sku,
      barcode: p.barcode,
    });
  } catch (error) {
    console.error('Get product by barcode error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category_id', 'name slug')
      .lean();

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const p = product as any;
    const stockQty = p.stock_quantity ?? 0;
    const committed = p.committed_quantity ?? 0;
    res.json({
      id: product._id.toString(),
      ...product,
      product_type: p.product_type || 'inventory',
      committed_quantity: committed,
      available_quantity: Math.max(0, stockQty - committed),
      category_id: p.category_id?._id?.toString(),
      category_name: p.category_id?.name,
      category_slug: p.category_id?.slug,
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Admin: Import preview (parse + validate, no DB write)
router.post('/import/preview', authenticateAdmin, upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'No CSV file uploaded. Use form field name: file' });
  }
  try {
    const result = buildPreview(req.file.buffer);
    res.json(result);
  } catch (error: any) {
    console.error('Import preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse CSV' });
  }
});

// Admin: Execute product import (transaction, create categories/subcategories as needed)
router.post('/import', authenticateAdmin, upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'No CSV file uploaded. Use form field name: file' });
  }
  try {
    const result = await executeImport(req.file.buffer, { skipDuplicatesByNameInSubcategory: true });
    res.json(result);
  } catch (error: any) {
    console.error('Product import error:', error);
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

// Admin: Create product
router.post('/', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      sku: z.string().optional(),
      description: z.string().optional(),
      product_type: z.enum(['inventory', 'non_inventory', 'service']).optional(),
      price: z.union([z.coerce.number().min(0), z.null()]).optional(),
      category_id: z.string().optional().or(z.literal('')),
      sub_category_id: z.string().optional().or(z.literal('')),
      vendor_id: z.string().optional().or(z.literal('')),
      tax_rate: z.coerce.number().min(0).optional(),
      image_url: z.union([z.string().url(), z.literal('')]).optional(),
      barcode: z.string().optional(),
      cost_price: z.coerce.number().min(0).optional(),
      stock_quantity: z.coerce.number().int().min(0).optional(),
      low_stock_threshold: z.coerce.number().int().min(0).optional(),
    });

    const raw = schema.parse(req.body);
    const data = {
      ...raw,
      category_id: raw.category_id || undefined,
      sub_category_id: raw.sub_category_id || undefined,
      vendor_id: raw.vendor_id || undefined,
      stock_quantity: raw.stock_quantity ?? 0,
      low_stock_threshold: raw.low_stock_threshold ?? 10,
    };
    const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const price = (data.price != null && !Number.isNaN(Number(data.price))) ? Number(data.price) : 0;

    const categoryId = toObjectIdOrUndefined(data.category_id);
    const subCategoryId = toObjectIdOrUndefined(data.sub_category_id);
    const vendorId = toObjectIdOrUndefined(data.vendor_id);

    const product = await Product.create({
      name: data.name,
      slug,
      sku: data.sku || (await generateItemId()),
      description: data.description,
      product_type: data.product_type || 'inventory',
      price,
      cost_price: data.cost_price ?? undefined,
      category_id: categoryId,
      sub_category_id: subCategoryId,
      vendor_id: vendorId,
      tax_rate: data.tax_rate ?? 0,
      image_url: data.image_url || undefined,
      barcode: data.barcode || undefined,
      stock_quantity: data.stock_quantity ?? 0,
      low_stock_threshold: data.low_stock_threshold ?? 10,
    });

    const obj = product.toObject();
    res.status(201).json({
      id: product._id.toString(),
      ...obj,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A product with this name or SKU/barcode already exists.' });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
});

// Admin: Update product
router.put('/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      product_type: z.enum(['inventory', 'non_inventory', 'service']).optional(),
      price: z.number().min(0).optional(),
      category_id: z.union([z.string(), z.null()]).optional(),
      sub_category_id: z.union([z.string(), z.null()]).optional(),
      vendor_id: z.string().optional(),
      tax_rate: z.number().min(0).optional(),
      image_url: z.union([z.string().url(), z.literal('')]).optional(),
      barcode: z.string().optional(),
      sku: z.string().optional(),
      cost_price: z.number().min(0).optional(),
      stock_quantity: z.number().int().optional(),
      low_stock_threshold: z.number().int().min(0).optional(),
      is_active: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const existing = await Product.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const update: any = { updated_at: new Date() };
    const unset: any = {};
    if (data.category_id !== undefined) {
      if (data.category_id === null || data.category_id === '') unset.category_id = 1;
      else update.category_id = data.category_id;
    }
    if (data.sub_category_id !== undefined) {
      if (data.sub_category_id === null || data.sub_category_id === '') unset.sub_category_id = 1;
      else update.sub_category_id = data.sub_category_id;
    }
    const rest = { ...data };
    delete rest.category_id;
    delete rest.sub_category_id;
    Object.keys(rest).forEach((k) => {
      if ((rest as any)[k] !== undefined) update[k] = (rest as any)[k];
    });
    if (Object.keys(unset).length) update.$unset = unset;

    const product = await Product.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Audit log for price/product_type changes
    const AuditLog = (await import('../models/AuditLog')).default;
    const changed = (key: string) => (existing as any)[key] !== (product as any)[key];
    if (changed('price') || changed('product_type')) {
      await AuditLog.create({
        admin_id: req.userId,
        action: 'product_update',
        entity_type: 'Product',
        entity_id: product._id.toString(),
        old_value: { price: existing.price, product_type: (existing as any).product_type },
        new_value: { price: product.price, product_type: (product as any).product_type },
        details: 'Admin updated product',
      });
    }

    res.json({
      id: product._id.toString(),
      ...product.toObject(),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Admin: Delete product
router.delete('/:id', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Admin: Bulk delete products (soft)
router.post('/bulk-delete', authenticateAdmin, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ ids: z.array(z.string()).min(1) });
    const { ids } = schema.parse(req.body);
    await Product.updateMany({ _id: { $in: ids } }, { is_active: false });
    res.json({ message: `${ids.length} product(s) deleted`, deleted: ids.length });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message });
    console.error('Bulk delete products error:', error);
    res.status(500).json({ error: 'Failed to delete products' });
  }
});

export default router;
