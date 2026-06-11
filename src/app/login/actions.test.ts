import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSet, redirect, verifierLimite, reinitialiserLimite, verifierMotDePasse } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  verifierLimite: vi.fn(),
  reinitialiserLimite: vi.fn(),
  verifierMotDePasse: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("@/lib/auth/rate-limit", () => ({
  verifierLimite,
  reinitialiserLimite,
}));

vi.mock("@/lib/auth/password", () => ({
  verifierMotDePasse,
}));

vi.mock("@/lib/auth/session", () => ({
  DUREE_SESSION_MS: 30 * 24 * 60 * 60 * 1000,
  SESSION_COOKIE: "yvia_session",
  pvDepuisHash: vi.fn(async () => "pv-test"),
  signerSession: vi.fn(async () => "token-test"),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => [
          {
            id: 1,
            email: "admin@yvia.io",
            passwordHash: "hash-test",
            role: "admin",
          },
        ],
      }),
    }),
  },
}));

import { connexion } from "./actions";

beforeEach(() => {
  cookieSet.mockReset();
  redirect.mockClear();
  verifierLimite.mockReset();
  reinitialiserLimite.mockReset();
  verifierMotDePasse.mockReset();
  verifierLimite.mockResolvedValue({ ok: true });
  reinitialiserLimite.mockResolvedValue(undefined);
  verifierMotDePasse.mockReturnValue(true);
});

describe("connexion", () => {
  it("redirige côté serveur après une connexion réussie", async () => {
    const formData = new FormData();
    formData.set("email", "ADMIN@YVIA.IO ");
    formData.set("motDePasse", "secret");

    await expect(connexion(formData)).rejects.toThrow("NEXT_REDIRECT:/");

    expect(cookieSet).toHaveBeenCalledWith(
      "yvia_session",
      "token-test",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
    expect(redirect).toHaveBeenCalledWith("/");
  });
});
