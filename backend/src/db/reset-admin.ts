/**
 * Reset admin credentials. Run: npx tsx src/db/reset-admin.ts
 * Sets admin to: admin@edinc.com / Admin1234
 */
import connectDB from './connection';
import Admin from '../models/Admin';
import bcrypt from 'bcryptjs';

const NEW_EMAIL = 'admin@edinc.com';
const NEW_PASSWORD = 'Admin1234';
const NEW_NAME = 'Admin';

async function resetAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    const updated = await Admin.findOneAndUpdate(
      { email: { $in: ['admin@edinc.com', 'admin@expressdistributors.com'] } },
      {
        email: NEW_EMAIL,
        password_hash: hashedPassword,
        name: NEW_NAME,
        role: 'admin',
      },
      { new: true }
    );

    if (updated) {
      console.log('Admin credentials updated.');
      console.log('Email:', NEW_EMAIL);
      console.log('Password:', NEW_PASSWORD);
      process.exit(0);
      return;
    }

    const created = await Admin.create({
      email: NEW_EMAIL,
      password_hash: hashedPassword,
      name: NEW_NAME,
      role: 'admin',
    });
    console.log('Admin created.');
    console.log('Email:', NEW_EMAIL);
    console.log('Password:', NEW_PASSWORD);
    process.exit(0);
  } catch (error: any) {
    console.error('Reset failed:', error);
    process.exit(1);
  }
}

resetAdmin();
