import type { NextConfig } from "next";

type CspEnv = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "VERCEL_ENV">>;
type HecatonEnv = { HECATON_PREVIEW_ORIGIN?: string };

export function creerAllowedDevOrigins(env?: HecatonEnv): string[] {
  const origin = (env?.HECATON_PREVIEW_ORIGIN ?? process.env.HECATON_PREVIEW_ORIGIN)?.trim();
  if (!origin) return [];

  try {
    return [new URL(origin).host];
  } catch {
    return [];
  }
}

export function creerCsp(env: CspEnv = process.env): string {
  const vercelLive = env.VERCEL_ENV === "preview";
  const scriptSrc = [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    ...(env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
    ...(vercelLive ? ["https://vercel.live"] : []),
  ].join(" ");

  const styleSrc = ["style-src", "'self'", "'unsafe-inline'", ...(vercelLive ? ["https://vercel.live"] : [])].join(
    " "
  );
  const imgSrc = ["img-src", "'self'", "blob:", "data:", ...(vercelLive ? ["https://vercel.live", "https://vercel.com"] : [])].join(
    " "
  );
  const connectSrc = ["connect-src", "'self'", ...(vercelLive ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : [])].join(
    " "
  );

  return [
    "default-src 'self'",
    scriptSrc,
    styleSrc,
    imgSrc,
    connectSrc,
    ...(vercelLive ? ["frame-src https://vercel.live"] : []),
    "font-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: creerAllowedDevOrigins(),
  async headers() {
    const headers = [
      {
        key: "Content-Security-Policy",
        value: creerCsp(),
      },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
    ];

    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
