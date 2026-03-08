import express from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User';
import Admin from '../models/Admin';
import OTP from '../models/OTP';
import bcrypt from 'bcryptjs';

const router = express.Router();

// NOTE: OTP-based login has been deprecated in favor of email/phone + password

// Admin login
router.post('/admin/login', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in .env');
      return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set. Add JWT_SECRET to backend .env' });
    }

    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    });

    const { email, password } = schema.parse(req.body);

    const emailLower = email.trim().toLowerCase();
    const admin = await Admin.findOne({ $expr: { $eq: [{ $toLower: '$email' }, emailLower] } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, admin.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET as Secret;
    const token = (jwt as any).sign(
      { adminId: admin._id.toString(), role: admin.role },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// User registration (email/phone + password)
router.post('/register', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in .env');
      return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set. Add JWT_SECRET to backend .env' });
    }

    const schema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().min(4).optional(),
      password: z.string().min(6),
    }).refine((data) => data.email || data.phone, {
      message: 'Either email or phone is required',
      path: ['email'],
    });

    const { name, email, phone, password } = schema.parse(req.body);

    // Ensure at least one unique identifier
    if (email) {
      const existingByEmail = await User.findOne({ email });
      if (existingByEmail) {
        return res.status(400).json({ error: 'A user with this email already exists' });
      }
    }
    if (phone) {
      const existingByPhone = await User.findOne({ phone });
      if (existingByPhone) {
        return res.status(400).json({ error: 'A user with this phone already exists' });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password_hash,
    });

    const secret = process.env.JWT_SECRET as Secret;
    const token = (jwt as any).sign(
      { userId: user._id.toString(), email: user.email, phone: user.phone },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        phone: user.phone,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('User register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login (email or phone + password)
router.post('/login', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in .env');
      return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set. Add JWT_SECRET to backend .env' });
    }

    const schema = z.object({
      email: z.string().email().optional(),
      phone: z.string().min(4).optional(),
      password: z.string().min(6),
    }).refine((data) => data.email || data.phone, {
      message: 'Either email or phone is required',
      path: ['email'],
    });

    const { email, phone, password } = schema.parse(req.body);

    const query: any = {};
    if (email) query.email = email;
    if (phone) query.phone = phone;

    const user = await User.findOne(query);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = process.env.JWT_SECRET as Secret;
    const token = (jwt as any).sign(
      { userId: user._id.toString(), email: user.email, phone: user.phone },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        phone: user.phone,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('User login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
