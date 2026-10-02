/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enables instrumentation.ts (startup check for ENCRYPTION_MASTER_KEY).
    instrumentationHook: true,
  },
};

export default nextConfig;
