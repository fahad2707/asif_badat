/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy /api to backend (so CSV import works when frontend uses relative /api)
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const base = target.startsWith('http') ? target.replace(/\/api\/?$/, '') : 'http://localhost:5000';
    return [
      { source: '/api/:path*', destination: `${base}/api/:path*` },
    ];
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig




