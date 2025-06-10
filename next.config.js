/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to load these modules on the client side
      config.resolve.fallback = {
        fs: false,
        path: false,
        crypto: false,
        stream: false,
      };
    }
    
    // Ensure proper module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      // Add any specific aliases if needed
    };
    
    // Ensure proper module resolution for node modules
    config.resolve.modules = ['node_modules', ...config.resolve.modules || []];
    
    return config;
  },
  // Ensure experimental features are enabled if needed
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    },
  },
};

module.exports = nextConfig;
