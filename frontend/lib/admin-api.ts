import axios from 'axios';

// Call backend directly so dashboard/products/etc load. Default: http://localhost:5000/api
// Set NEXT_PUBLIC_API_URL to override (e.g. /api to use Next.js rewrites, or another server).
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const adminApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

// Helper for file uploads (doesn't set Content-Type, let browser set it)
export const uploadApi = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

// Add admin auth token to upload requests
uploadApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add admin auth token to requests
adminApi.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors (don't redirect on 401 from admin login attempt - let the page show error)
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isLoginAttempt = error.config?.url?.includes('/auth/admin/login');
      if (!isLoginAttempt && typeof window !== 'undefined') {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// POS API helpers
export const posApi = {
  searchProducts: (query: string, type: string) =>
    adminApi.get(`/pos/products/search?q=${encodeURIComponent(query)}&type=${type}`),
  createSale: (data: any) => adminApi.post('/pos/sale', data),
  getSales: (params?: any) => adminApi.get('/pos/sales', { params }),
  getSale: (id: string) => adminApi.get(`/pos/sales/${id}`),
};

export default adminApi;
