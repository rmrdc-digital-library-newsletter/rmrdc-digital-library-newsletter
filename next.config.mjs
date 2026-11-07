/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./legacy-pages/**/*"]
  }
};

export default nextConfig;
