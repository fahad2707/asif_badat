/**
 * Single admin only: admin@edinc.com / Admin1234
 * Run: npx tsx src/db/reset-admin.ts
 * - Deletes the old admin (admin@expressdistributors.com) if it exists
 * - Ensures one admin exists with admin@edinc.com / Admin1234
 */
import connectDB from './connection';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = 'admin@edinc.com';
const ADMIN_PASSWORD = 'Admin1234';
const OLD_ADMIN_EMAIL = 'admin@expressdistributors.com';

async function resetAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();

    // Remove old admin so we only have one (admin@edinc.com)
    const deleted = await Admin.deleteMany({ email: OLD_ADMIN_EMAIL });
    if (deleted.deletedCount > 0) {
      console.log(`Removed ${deleted.deletedCount} old admin(s) (${OLD_ADMIN_EMAIL}).`);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    let admin = await Admin.findOne({ email: ADMIN_EMAIL });

    if (admin) {
      await Admin.updateOne(
        { email: ADMIN_EMAIL },
        { password_hash: hashedPassword, name: 'Admin', role: 'admin' }
      );
      console.log('Admin credentials updated.');
    } else {
      await Admin.create({
        email: ADMIN_EMAIL,
        password_hash: hashedPassword,
        name: 'Admin',
        role: 'admin',
      });
      console.log('Admin created.');
    }
    console.log('Email:', ADMIN_EMAIL);
    console.log('Password:', ADMIN_PASSWORD);
    process.exit(0);
  } catch (error: any) {
    console.error('Reset failed:', error);
    process.exit(1);
  }
}

resetAdmin();
