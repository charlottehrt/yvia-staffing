import { describe, it, expect } from "vitest";

// api-key.ts importe @/db, qui exige DATABASE_URL au chargement du module. On
// fournit une URL factice (le client postgres est paresseux : aucune connexion
// n'est ouverte tant qu'on ne lance pas de requête) puis on importe le module
// dynamiquement, une fois la variable d'environnement posée.
process.env.DATABASE_URL ??= "postgres://placeholder:placeholder@localhost:5432/placeholder";
const { genererCleApi, hacherToken, PREFIXE_CLE } = await import("./api-key");

describe("genererCleApi", () => {
  it("génère une clé préfixée yvia_sk_", () => {
    const { token } = genererCleApi();
    expect(token.startsWith(PREFIXE_CLE)).toBe(true);
    expect(token.length).toBeGreaterThan(PREFIXE_CLE.length + 20);
  });

  it("renvoie un préfixe affichable qui est bien le début du token", () => {
    const { token, prefixe } = genererCleApi();
    expect(token.startsWith(prefixe)).toBe(true);
    expect(prefixe.startsWith(PREFIXE_CLE)).toBe(true);
    // Le préfixe ne révèle pas toute la clé.
    expect(prefixe.length).toBeLessThan(token.length);
  });

  it("renvoie un tokenHash cohérent avec hacherToken(token)", () => {
    const { token, tokenHash } = genererCleApi();
    expect(tokenHash).toBe(hacherToken(token));
  });

  it("génère des clés uniques", () => {
    const a = genererCleApi();
    const b = genererCleApi();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hacherToken", () => {
  it("est déterministe (même entrée -> même empreinte)", () => {
    expect(hacherToken("yvia_sk_exemple")).toBe(hacherToken("yvia_sk_exemple"));
  });

  it("produit une empreinte SHA-256 de 64 caractères hexadécimaux", () => {
    expect(hacherToken("peu importe")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("change d'empreinte si l'entrée change", () => {
    expect(hacherToken("clé-a")).not.toBe(hacherToken("clé-b"));
  });
});
