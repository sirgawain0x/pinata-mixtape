/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/app",
  // kokoro-js loads voice .bin files via path relative to its dist/ folder; bundling breaks that (ENOENT under .next/server/voices).
  serverExternalPackages: ["kokoro-js"]
};

export default nextConfig;
