'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '@/lib/admin-api';
import toast from 'react-hot-toast';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await adminApi.post('/auth/admin/login', { email, password });
      localStorage.setItem('adminToken', response.data.token);
      toast.success('Login successful!');
      router.push('/admin/dashboard');
    } catch (error: any) {
      const msg = error.response?.data?.error || error.message;
      if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || !error.response) {
        toast.error('Cannot reach server. Is the backend running? Start it with: npm run dev (from project root)');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
          Admin Login
        </h1>
        <p className="text-center text-gray-600 mb-8">Express Distributors Inc</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@expressdistributors.com"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Default: admin@edinc.com / Admin1234
        </p>
        <p className="mt-1 text-center text-xs text-gray-400">
          If login or website fails, run backend and seed — see FIX_LOGIN_AND_PRODUCTS.md
        </p>
      </div>
    </div>
  );
}




