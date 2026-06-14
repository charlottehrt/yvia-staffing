import { describe, expect, it } from "vitest";
import nextConfig, { creerAllowedDevOrigins, creerCsp } from "./next.config";

async function lireCsp(): Promise<string> {
  const routes = await nextConfig.headers?.();
  const headers = routes?.[0]?.headers ?? [];
  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value;

  if (!csp) throw new Error("Header Content-Security-Policy introuvable");
  return csp;
}

describe("next.config Content-Security-Policy", () => {
  it("autorise les scripts inline nécessaires au bootstrap Next", async () => {
    await expect(lireCsp()).resolves.toContain("script-src 'self' 'unsafe-inline'");
  });

  it("autorise le widget Vercel Live sur les previews", () => {
    const csp = creerCsp({ VERCEL_ENV: "preview", NODE_ENV: "production" });

    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://vercel.live");
    expect(csp).toContain("connect-src 'self' https://vercel.live wss://ws-us3.pusher.com");
    expect(csp).toContain("frame-src https://vercel.live");
  });

  it("autorise l'origine de preview Hecaton pour les ressources dev Next", () => {
    expect(
      creerAllowedDevOrigins({
        HECATON_PREVIEW_ORIGIN: "https://lima-bx0.hecaton.eplp.fr",
      })
    ).toEqual(["lima-bx0.hecaton.eplp.fr"]);
  });
});
