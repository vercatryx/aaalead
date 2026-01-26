/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable static file serving for templates
  async rewrites() {
    return [];
  },
  // Remove 'standalone' output for Vercel deployment
  // output: 'standalone', // Only use for Docker deployments
  // Turbopack configuration - note: webpack config above still applies when not using Turbopack
  // For Turbopack, we need to handle pdfjs-dist differently
  // Note: Removed turbo config as it's not needed for Vercel deployment
  // experimental: {
  //   turbo: {
  //     resolveAlias: {
  //       canvas: false,
  //     },
  //   },
  // },
  webpack: (config, { isServer }) => {
    // Fix for pdfjs-dist compatibility with Next.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
      };
    }
    
    // Handle pdfjs-dist properly - prevent it from bundling Node.js modules
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    
    // Ignore canvas and other Node.js modules in client bundle
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        canvas: 'canvas',
      });
    }
    
    // Ignore dynamic worker imports in pdfjs-dist
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    
    // Add rule to ignore worker file imports
    config.module.rules.push({
      test: /pdf\.worker\.(min\.)?mjs$/,
      type: 'asset/resource',
    });
    
    return config;
  },
}

module.exports = nextConfig
