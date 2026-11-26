type ImageLoaderProps = {
  src: string;
  width: number;
  quality?: number;
};

// Transparent 1x1 GIF. Returned instead of a malformed transform URL so we never hand an
// empty/invalid source to Cloudflare (which triggers a self-request loop / edge 404).
const transparentPixel = (width: number) =>
  `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#w=${width}`;

/**
 * Custom Next.js image loader for Cloudflare Image Transformations.
 *
 * Handles three source types:
 *  1. Images already served from our own CDN zone (the configured ASSETS_URL)
 *  2. Relative storage keys (e.g. "images/abc123") — our own bucket,
 *     no longer stored with a full URL in the DB, so we reconstruct the CDN path directly.
 *  3. Third-party absolute URLs (Paytrail, etc.)
 *  4. Local relative files served from /public
 *
 * NOTE: Any third-party domain used here (case 3) must also be added to
 * "Allowed Origins" in the Cloudflare dashboard under
 * Images > Transformations > Sources, otherwise Cloudflare will reject
 * the fetch even if the URL is correctly formed.
 */
export default function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  // Failsafe: some records may have an empty/null src (bad data, missing upload, etc).
  // Returning a transparent 1x1 GIF data URL avoids passing an empty string or "undefined"
  // into an <img> tag, which would trigger a browser self-request loop for the current page
  // and cause internal Node.js streaming race condition crashes.
  if (!src) {
    return transparentPixel(width);
  }

  // Build the shared Cloudflare transform params (width + format are always present).
  const params = [`width=${width}`, "format=auto", "onerror=redirect"];
  if (quality) {
    params.push(`quality=${quality ?? 75}`);
  }

  const assetsUrl = process.env.NEXT_PUBLIC_ASSETS_URL?.trim().replace(/\/+$/, "");

  // Local/dev bypass: skip Cloudflare entirely and just append params as query string.
  // Useful when running locally without a tunnel, since Cloudflare's edge can't reach localhost.
  // Opt-out flag (must match next.config.ts): optimization stays on unless
  // explicitly disabled, so a missing env var can't silently disable it.
  // Without an assets URL there is no Cloudflare zone to transform through.
  const optimizationEnabled = process.env.NEXT_PUBLIC_OPTIMIZE_IMAGES !== "false";
  if (!optimizationEnabled || !assetsUrl) {
    return `${src}?${params.join("&")}`;
  }

  // --- Case 1: Image already lives on our own CDN zone ---
  // Same-zone sources are always allowed by Cloudflare, no extra origin config needed.
  const assetsHost = assetsUrl.replace(/^https?:\/\//, "").split("/")[0];
  if (src.includes(`://${assetsHost}/`)) {
    let cleanSrc = src;
    if (src.startsWith("http")) {
      try {
        cleanSrc = new URL(src).pathname;
      } catch {
        // Fall back to the original source below if it is not a valid URL.
      }
    }

    // Strip any leading slashes to avoid a double-slash ("//") in the final URL,
    // which Cloudflare treats as a malformed path and returns a 404 for.
    cleanSrc = cleanSrc.replace(/^\/+/, "");

    // If the source was nothing but the CDN base (bad data), cleanSrc is now empty and we'd
    // emit ".../cdn-cgi/image/<opts>/" — a sourceless transform Cloudflare 404s on.
    if (!cleanSrc) {
      return transparentPixel(width);
    }

    return `${assetsUrl}/cdn-cgi/image/${params.join(",")}/${cleanSrc}`;
  }
  // --- Case 2: Local relative files served from /public or /_next ---
  // Since the backend now returns absolute URLs for all CDN images,
  // any relative path passed to next/image is a local asset (like the logo).
  // We return it directly so the browser loads it from the local Next.js server.
  // We append the width as a query param so Next.js knows we implement width and doesn't crash.
  if (!src.startsWith("http")) {
    return src.includes("?") ? `${src}&width=${width}` : `${src}?width=${width}`;
  }
  // --- Case 3: Third-party absolute URL (Paytrail, etc.) ---
  // Must be in Cloudflare's Allowed Origins list or the transform request is rejected.
  // Encode the full URL so its own query params/slashes don't break Cloudflare's path parsing.
  const encodedUrl = encodeURIComponent(src);
  return `${assetsUrl}/cdn-cgi/image/${params.join(",")}/${encodedUrl}`;
}
