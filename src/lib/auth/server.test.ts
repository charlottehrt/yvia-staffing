import { describe, it, expect, vi, beforeEach } from "vitest";

// getSession lit le cookie (next/headers) puis va chercher le hash courant de
// l'utilisateur en base pour comparer l'ancre de révocation (pv). On mocke les
// deux dépendances pour piloter ces valeurs.

const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

const { etatDb } = vi.hoisted(() => ({
  etatDb: {
    rows: [] as Array<{ id: number; email: string; passwordHash: string; role: "admin" | "user" }>,
  },
}));
vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => etatDb.rows }) }),
  },
}));

import { getSession } from "./server";
import { signerSession, pvDepuisHash, DUREE_SESSION_MS } from "./session";

beforeEach(() => {
  process.env.SESSION_SECRET = "secret-de-test-uniquement";
  cookieGet.mockReset();
  etatDb.rows = [];
});

async function jetonPour(passwordHash: string): Promise<string> {
  const pv = await pvDepuisHash(passwordHash);
  return signerSession({ userId: 1, email: "a@yvia.io", exp: Date.now() + DUREE_SESSION_MS, pv, role: "admin" });
}

describe("getSession : révocation par changement de mot de passe", () => {
  it("renvoie la session quand le pv correspond au hash courant", async () => {
    const hash = "hash-courant";
    cookieGet.mockReturnValue({ value: await jetonPour(hash) });
    etatDb.rows = [{ id: 1, email: "a@yvia.io", passwordHash: hash, role: "admin" }];
    expect(await getSession()).toMatchObject({ userId: 1, email: "a@yvia.io", role: "admin" });
  });

  it("révoque la session quand le mot de passe a changé (pv obsolète)", async () => {
    cookieGet.mockReturnValue({ value: await jetonPour("ancien-hash") });
    etatDb.rows = [{ id: 1, email: "a@yvia.io", passwordHash: "nouveau-hash", role: "admin" }];
    expect(await getSession()).toBeNull();
  });

  it("renvoie null quand l'utilisateur n'existe plus", async () => {
    cookieGet.mockReturnValue({ value: await jetonPour("hash") });
    etatDb.rows = [];
    expect(await getSession()).toBeNull();
  });

  it("renvoie null en l'absence de cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
  });
});
