/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Shown in the ?debug=1 audio log on /app.
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
  },
  experimental: {
    // Enables instrumentation.ts (startup check for ENCRYPTION_MASTER_KEY).
    instrumentationHook: true,
  },
};

export default nextConfig;
