import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import connectDB from './db/connection';

// Routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import subCategoryRoutes from './routes/sub-categories';
import taxTypesRoutes from './routes/tax-types';
import paymentMethodsRoutes from './routes/payment-methods';
import bankAccountsRoutes from './routes/bank-accounts';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import posRoutes from './routes/pos';
import invoiceRoutes from './routes/invoices';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/user';
import uploadRoutes from './routes/upload';
import customersRoutes from './routes/customers';
import vendorsRoutes from './routes/vendors';
import purchaseOrdersRoutes from './routes/purchase-orders';
import storeSettingsRoutes from './routes/store-settings';
import inventoryRoutes from './routes/inventory';
import returnsRoutes from './routes/returns';
import receiptsRoutes from './routes/receipts';
import creditMemoRoutes from './modules/credit-memo/routes/creditMemo';
import shipmentRoutes from './modules/shipping/routes/shipments';
import expenseRoutes from './modules/expenses/routes/expenses';
import reportRoutes from './modules/reports/routes/reports';
import onlineOrderRoutes from './routes/online-orders';

dotenv.config();

// Keep the process alive on unhandled promise rejections (e.g. async route errors)
// so the server does not crash and you can see the logged error.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());
// Allow both localhost and 127.0.0.1 so frontend works from either
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
].filter(Boolean) as string[];
app.use(cors({
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, true);
  },
  credentials: true,
}));


// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve uploaded files (customer documents, etc.)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sub-categories', subCategoryRoutes);
app.use('/api/tax-types', taxTypesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/bank-accounts', bankAccountsRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/store-settings', storeSettingsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/credit-memos', creditMemoRoutes);
app.use('/api/online-orders', onlineOrderRoutes);
app.use('/api/online-orders', onlineOrderRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
