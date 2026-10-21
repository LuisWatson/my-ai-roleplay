/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a phone load the dev server via the PC's LAN IP or a Dev Tunnels URL.
  allowedDevOrigins: ['192.168.2.120', '*.devtunnels.ms'],
};

export default nextConfig;
