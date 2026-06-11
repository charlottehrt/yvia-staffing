import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

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
});
