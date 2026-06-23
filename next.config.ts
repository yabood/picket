import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // These libraries (PDF.js via unpdf, linkedom's entity tables) do fs/dynamic
  // requires that Next would otherwise trace across the whole project. Loading
  // them as external node_modules at runtime keeps the function bundle lean.
  serverExternalPackages: ['unpdf', 'linkedom', '@mozilla/readability'],
};

export default nextConfig;
