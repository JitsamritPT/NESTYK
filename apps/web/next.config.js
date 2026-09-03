const API_URL = process.env.API_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@nestyk/ui',
    '@nestyk/config',
    '@nestyk/types',
    '@nestyk/i18n',
    '@nestyk/feature-search',
    '@nestyk/feature-services',
    '@nestyk/feature-listing',
  ],
  async rewrites() {
    return [
      // ⚡ Unified Backend API (/api/* -> localhost:4000/api/v1/*)
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
