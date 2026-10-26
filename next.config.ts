import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dev server is proxied by the sandbox preview host, so cross-origin dev
  // requests must be allowed explicitly.
  allowedDevOrigins: ['*.e2b.app', '*.arena.ai', 'localhost', '127.0.0.1'],
  serverExternalPackages: ['@grpc/grpc-js', '@mysten-incubation/memwal'],
};

export default nextConfig;
