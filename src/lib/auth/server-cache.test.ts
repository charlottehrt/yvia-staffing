import { describe, expect, it, vi } from "vitest";

const { cookieGet, etatDb, appelsSelect } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  etatDb: {
    rows: [] as Array<{ id: number; email: string; passwordHash: string; role: "admin" | "user" }>,
  },
  appelsSelect: { count: 0 },
}));

vi.mock("react", () => ({
  cache: <Args extends unknown[], Return>(fn: (...args: Args) => Return) => {
    const resultats = new Map<string, Return>();
    return (...args: Args) => {
      const cle = JSON.stringify(args);
      if (!resultats.has(cle)) resultats.set(cle, fn(...args));
      return resultats.get(cle) as Return;
    };
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => {
      appelsSelect.count += 1;
      return { from: () => ({ where: async () => etatDb.rows }) };
    },
  },
}));

import { getSession } from "./server";
import { DUREE_SESSION_MS, pvDepuisHash, signerSession } from "./session";

async function jetonPour(passwordHash: string): Promise<string> {
  const pv = await pvDepuisHash(passwordHash);
  return signerSession({ userId: 1, email: "a@yvia.io", exp: Date.now() + DUREE_SESSION_MS, pv, role: "admin" });
}

describe("getSession : cache de rendu", () => {
  it("déduplique la lecture utilisateur pendant le même rendu", async () => {
    process.env.SESSION_SECRET = "secret-de-test-uniquement";
    const passwordHash = "hash-courant";
    cookieGet.mockReturnValue({ value: await jetonPour(passwordHash) });
    etatDb.rows = [{ id: 1, email: "a@yvia.io", passwordHash, role: "admin" }];

    const [premiere, seconde] = await Promise.all([getSession(), getSession()]);

    expect(premiere).toMatchObject({ userId: 1, email: "a@yvia.io", role: "admin" });
    expect(seconde).toMatchObject({ userId: 1, email: "a@yvia.io", role: "admin" });
    expect(appelsSelect.count).toBe(1);
  });
});
