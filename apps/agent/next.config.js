/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/agent',
  transpilePackages: [
    '@nestyk/ui',
    '@nestyk/config',
    '@nestyk/types',
    '@nestyk/i18n',
    '@nestyk/feature-listing',
    '@nestyk/feature-services',
  ],
};

module.exports = nextConfig;
