/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: {
      ignoreDuringBuilds: true,   // 忽略 ESLint 错误
    },
    typescript: {
      ignoreBuildErrors: true,    // 忽略 TypeScript 错误
    },
  };
  
  module.exports = nextConfig;