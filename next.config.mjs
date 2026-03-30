/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Enables static export
  images: {
    unoptimized: true, // Necessary because Github Pages cannot run the Next.js image optimizer
  },
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;
