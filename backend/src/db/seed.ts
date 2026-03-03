import connectDB from './connection';
import Admin from '../models/Admin';
import Category from '../models/Category';
import Product from '../models/Product';
import bcrypt from 'bcryptjs';

async function seed() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ Connected! Starting seed...');

    // Clear existing products and categories (you will create your own)
    console.log('🔄 Clearing existing categories and products...');
    await Product.deleteMany({});
    await Category.deleteMany({});
    console.log('✅ Cleared categories and products!');

    // Create default admin only (admin@edinc.com / Admin1234)
    const defaultEmail = 'admin@edinc.com';
    const existingAdmin = await Admin.findOne({ email: defaultEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('Admin1234', 10);
      await Admin.create({
        email: defaultEmail,
        password_hash: hashedPassword,
        name: 'Admin',
        role: 'admin',
      });
      console.log('✅ Default admin created (email: admin@edinc.com, password: Admin1234)');
    } else {
      console.log('✅ Admin already exists');
    }

    console.log('✅ Seed complete. Add your own categories and products from the admin panel.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error);
    if (error.message?.includes('MongoServerError') || error.message?.includes('connection')) {
      console.error('\n💡 TIP: Make sure MongoDB is running and MONGODB_URI in .env is correct!');
    }
    process.exit(1);
  }
}

seed();
