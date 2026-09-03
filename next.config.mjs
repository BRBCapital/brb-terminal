/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise the framework (X-Powered-By)
  // `pg` opens TCP sockets and resolves optional native/pg-native bindings —
  // keep it out of the bundler so it loads as a normal Node module in server
  // routes. (Replaces the former PGlite entry; PGlite needed this for its WASM
  // and fs access.)
  //
  // instrumentationHook is deliberately gone: it started the in-process
  // setInterval workers, which cannot survive on serverless. The alert and
  // engine cadences now arrive as HTTP requests — see src/app/api/cron/*.
  experimental: {
    serverComponentsExternalPackages: ["pg"],
  },
  images: {
    remotePatterns: [
      // NGX company logos served by the API
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
    ],
  },
  // Security headers applied at the app tier (so they hold regardless of the
  // proxy/load-balancer in front). CSP permits the app's inline <style> blocks
  // and Next's inline bootstrap script while blocking external script/object
  // origins; images allow data: URIs and https logos.
  async headers() {
    // 'unsafe-eval' is required by Next's dev-mode React Refresh/HMR but NOT at
    // runtime in production — so we drop it from the production CSP to harden
    // script-src against eval-based XSS. 'unsafe-inline' remains because Next's
    // hydration bootstrap emits inline <script> without a nonce.
    const isProd = process.env.NODE_ENV === "production";
    const scriptSrc = isProd
      ? "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "frame-src 'self' https://challenges.cloudflare.com",
      "connect-src 'self' https:",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
