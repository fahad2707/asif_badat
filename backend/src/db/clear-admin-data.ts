/**
 * Clear admin portal data for fresh testing.
 * Deletes: Invoices, Customers, Vendors (suppliers), Categories, SubCategories.
 * Does NOT delete: Admin users, Products, Orders, or other data.
 */
import connectDB from './connection';
import Invoice from '../models/Invoice';
import Customer from '../models/Customer';
import Vendor from '../models/Vendor';
import Category from '../models/Category';
import SubCategory from '../models/SubCategory';
import Receipt from '../models/Receipt';

async function clearAdminData() {
  await connectDB();

  const results = { invoices: 0, customers: 0, vendors: 0, categories: 0, subCategories: 0, receipts: 0 };

  const r1 = await Invoice.deleteMany({});
  results.invoices = r1.deletedCount;
  console.log(`  Invoices: ${results.invoices} deleted`);

  const r2 = await Customer.deleteMany({});
  results.customers = r2.deletedCount;
  console.log(`  Customers: ${results.customers} deleted`);

  const r3 = await Vendor.deleteMany({});
  results.vendors = r3.deletedCount;
  console.log(`  Vendors (suppliers): ${results.vendors} deleted`);

  const r4 = await Receipt.deleteMany({});
  results.receipts = r4.deletedCount;
  console.log(`  Receipts: ${results.receipts} deleted`);

  const r5 = await SubCategory.deleteMany({});
  results.subCategories = r5.deletedCount;
  console.log(`  Sub-categories: ${results.subCategories} deleted`);

  const r6 = await Category.deleteMany({});
  results.categories = r6.deletedCount;
  console.log(`  Categories: ${results.categories} deleted`);

  console.log('\n✅ Admin data cleared. You can start fresh testing.');
  process.exit(0);
}

clearAdminData().catch((err) => {
  console.error('Failed to clear data:', err);
  process.exit(1);
});
