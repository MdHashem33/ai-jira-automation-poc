/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mailparser', 'imapflow'],
  },
};

export default nextConfig;
