/**
 * Clear ALL data from the database for a full reset.
 * Use when you want to start completely fresh (e.g. after redeploy, "product already added" issues).
 *
 * Deletes: products, customers, categories, subcategories, vendors (suppliers),
 * invoices, receipts, orders, credit memos, purchase orders, expenses, shipments,
 * stock movements, payments, ledger, audit logs, bank accounts, tax types,
 * payment methods, POS sales, returns, users, OTPs, store settings, and admins.
 *
 * After running: run `npm run seed` (from backend folder) to create the default admin again.
 */
import connectDB from './connection';
import Admin from '../models/Admin';
import AuditLog from '../models/AuditLog';
import BankAccount from '../models/BankAccount';
import Category from '../models/Category';
import CreditMemo from '../modules/credit-memo/models/CreditMemo';
import Customer from '../models/Customer';
import Expense from '../modules/expenses/models/Expense';
import ExpenseCategory from '../modules/expenses/models/ExpenseCategory';
import Invoice from '../models/Invoice';
import LedgerEntry from '../models/LedgerEntry';
import Order from '../models/Order';
import OrderItem from '../models/OrderItem';
import OrderStatusHistory from '../models/OrderStatusHistory';
import OTP from '../models/OTP';
import Payment from '../models/Payment';
import PaymentMethod from '../models/PaymentMethod';
import POSSale from '../models/POSSale';
import Product from '../models/Product';
import PurchaseOrder from '../models/PurchaseOrder';
import Receipt from '../models/Receipt';
import Return from '../models/Return';
import Shipment from '../modules/shipping/models/Shipment';
import StockMovement from '../models/StockMovement';
import StoreSettings from '../models/StoreSettings';
import SubCategory from '../models/SubCategory';
import TaxType from '../models/TaxType';
import User from '../models/User';
import Vendor from '../models/Vendor';

const COLLECTIONS: { name: string; model: { deleteMany: (filter?: object) => Promise<{ deletedCount: number }> } }[] = [
  { name: 'CreditMemos', model: CreditMemo },
  { name: 'Invoices', model: Invoice },
  { name: 'Receipts', model: Receipt },
  { name: 'OrderItems', model: OrderItem },
  { name: 'OrderStatusHistories', model: OrderStatusHistory },
  { name: 'Orders', model: Order },
  { name: 'PurchaseOrders', model: PurchaseOrder },
  { name: 'Expenses', model: Expense },
  { name: 'ExpenseCategories', model: ExpenseCategory },
  { name: 'Shipments', model: Shipment },
  { name: 'StockMovements', model: StockMovement },
  { name: 'Payments', model: Payment },
  { name: 'LedgerEntries', model: LedgerEntry },
  { name: 'Returns', model: Return },
  { name: 'POSSales', model: POSSale },
  { name: 'AuditLogs', model: AuditLog },
  { name: 'Products', model: Product },
  { name: 'SubCategories', model: SubCategory },
  { name: 'Categories', model: Category },
  { name: 'Customers', model: Customer },
  { name: 'Vendors', model: Vendor },
  { name: 'BankAccounts', model: BankAccount },
  { name: 'TaxTypes', model: TaxType },
  { name: 'PaymentMethods', model: PaymentMethod },
  { name: 'StoreSettings', model: StoreSettings },
  { name: 'OTPs', model: OTP },
  { name: 'Users', model: User },
  { name: 'Admins', model: Admin },
];

async function clearAllData() {
  console.log('🔄 Connecting to MongoDB...');
  await connectDB();
  console.log('🗑️  Clearing ALL collections...\n');

  for (const { name, model } of COLLECTIONS) {
    try {
      const result = await model.deleteMany({});
      console.log(`  ${name}: ${result.deletedCount} document(s) deleted`);
    } catch (err: any) {
      console.error(`  ${name}: ERROR - ${err.message}`);
    }
  }

  console.log('\n✅ Database cleared. Run "npm run seed" (from backend folder) to create the default admin and start fresh.');
  process.exit(0);
}

clearAllData().catch((err) => {
  console.error('Failed to clear data:', err);
  process.exit(1);
});
