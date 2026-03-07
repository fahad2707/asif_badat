import connectDB from './connection';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

async function migrate() {
  try {
    await connectDB();
    
    // Create default admin user if it doesn't exist (single admin: admin@edinc.com)
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
      console.log('✅ Default admin created');
      console.log('   Email: admin@edinc.com');
      console.log('   Password: Admin1234');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    console.log('✅ Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
