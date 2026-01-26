/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable static file serving for templates
  async rewrites() {
    return [];
  },
}

module.exports = nextConfig
