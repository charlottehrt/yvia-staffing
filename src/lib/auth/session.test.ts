import { describe, it, expect, beforeAll } from "vitest";
import { signerSession, verifierSession, pvDepuisHash, type Session } from "./session";

// Le secret est lu paresseusement (à chaque signature/vérification), donc le
// définir avant les tests suffit.
beforeAll(() => {
  process.env.SESSION_SECRET = "secret-de-test-uniquement";
});

function sessionDeBase(): Session {
  return { userId: 1, email: "a@yvia.io", exp: Date.now() + 60_000, pv: "ancre", role: "admin" };
}

describe("signerSession / verifierSession", () => {
  it("valide un jeton fraîchement signé et restitue le payload", async () => {
    const s = sessionDeBase();
    expect(await verifierSession(await signerSession(s))).toEqual(s);
  });

  it("rejette un jeton dont la signature ne correspond pas au payload", async () => {
    // payload d'une session, signature d'une autre : HMAC valide mais incohérent.
    const [payloadA] = (await signerSession(sessionDeBase())).split(".");
    const [, sigB] = (await signerSession({ ...sessionDeBase(), userId: 2 })).split(".");
    expect(await verifierSession(`${payloadA}.${sigB}`)).toBeNull();
  });

  it("rejette un jeton expiré", async () => {
    const token = await signerSession({ ...sessionDeBase(), exp: Date.now() - 1 });
    expect(await verifierSession(token)).toBeNull();
  });

  it("rejette un ancien jeton sans ancre de révocation (pv)", async () => {
    // Signé avec la vraie clé mais sans champ pv : signature valide, pv manquant.
    const sansPv = {
      userId: 1,
      email: "a@yvia.io",
      exp: Date.now() + 60_000,
      role: "admin",
    } as unknown as Session;
    expect(await verifierSession(await signerSession(sansPv))).toBeNull();
  });
});

describe("pvDepuisHash", () => {
  it("est déterministe pour un même hash", async () => {
    expect(await pvDepuisHash("hash-A")).toBe(await pvDepuisHash("hash-A"));
  });

  it("change quand le hash du mot de passe change", async () => {
    expect(await pvDepuisHash("hash-A")).not.toBe(await pvDepuisHash("hash-B"));
  });
});
