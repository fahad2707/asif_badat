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

const RETRY_DELAY_MS = 2200;
const MAX_RETRIES = 1;

function isNetworkError(err: any) {
  if (!err) return false;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') return true;
  if (err.message && (err.message === 'Network Error' || err.message.includes('access control'))) return true;
  if (!err.response && err.request) return true; // connection lost / no response
  return false;
}

// Retry once on network/connection failure (e.g. backend cold start on Render)
adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const retryCount = config?.__retryCount ?? 0;
    if (isNetworkError(error) && config && retryCount < MAX_RETRIES) {
      config.__retryCount = retryCount + 1;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return adminApi.request(config);
    }
    if (error.response?.status === 401) {
      const isLoginAttempt = config?.url?.includes('/auth/admin/login');
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
