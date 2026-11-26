import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    /*
		deviceSizes allows you to specify a list of device width breakpoints. These widths are used when the next/image
		component uses sizes prop to ensure the correct image is served for the user's device.
		If we want to allow other sizes aswell we need to edit cloudflare rule to prevent abuse,
		securityrules -> customrules
		*/
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    /*
		imageSizes allows you to specify a list of image widths.
		These widths are concatenated with the array of device sizes to form the full array of sizes used to generate image srcset
		If we want to allow other sizes aswell we need to edit cloudflare rule to prevent abuse,
		securityrules -> customrules
		 */
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    /*
		If we want to allow other qualities aswell we need to edit cloudflare rule to prevent abuse,
		securityrules -> customrules
 		*/
    loader: "custom",
    loaderFile: "./src/utils/cloudflareLoader.ts",
    qualities: [55, 60, 75, 100],
    // Opt-out flag: optimization stays on unless explicitly disabled, so a
    // missing env var can't silently ship unoptimized images to production.
    // Set NEXT_PUBLIC_OPTIMIZE_IMAGES=false for local dev.
    unoptimized: process.env.NEXT_PUBLIC_OPTIMIZE_IMAGES === "false",
    // Cloudflare r2 ect
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
      },
      {
        protocol: "https",
        hostname: "resources.paytrail.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    const baseHeaders = [
      // Local files /public/images/
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=2592000",
          },
        ],
      },
    ];

    if (process.env.NODE_ENV !== "production") {
      return baseHeaders;
    }
    return [
      ...baseHeaders,
      {
        source: "/:path*",
        // TODO: Make sure the CSP does not affect development in the future.
        // Currently this CSP header is very lenient as to what is allowed to be loaded on the website,
        // so applying nonces (https://youtu.be/MNT0O94FYTg?si=CSTz-He0abQUYoha) might be the smart move here.
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-elem 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:; media-src 'self' https:; worker-src 'self' blob: https:; form-action 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: process.env.SENTRY_ORG,

  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeTracing: true,
  },

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
