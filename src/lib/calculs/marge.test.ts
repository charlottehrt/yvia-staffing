import { describe, it, expect } from "vitest";
import { calculMissionRealisee, margeParJour, calculMarge } from "./marge";

describe("marge par jour", () => {
  it("est la différence entre TJM vente et TJM achat", () => {
    expect(margeParJour(500, 650)).toBe(150);
  });
});

describe("calcul de marge d'une mission", () => {
  it("calcule CA, coût, marge et taux", () => {
    // 20 jours, achat 500, vente 650
    const r = calculMarge(20, 500, 650);
    expect(r.ca).toBe(13000);
    expect(r.cout).toBe(10000);
    expect(r.marge).toBe(3000);
    // taux = 3000 / 13000 ≈ 0,2308
    expect(r.tauxMarge).toBeCloseTo(0.2308, 4);
  });

  it("gère les jours facturables décimaux", () => {
    // 13,2 jours × 650 = 8 580 €
    const r = calculMarge(13.2, 500, 650);
    expect(r.ca).toBe(8580);
    expect(r.marge).toBe(1980); // 13,2 × 150
  });

  it("renvoie un taux de 0 quand il n'y a rien à facturer (pas de division par zéro)", () => {
    const r = calculMarge(0, 500, 650);
    expect(r.ca).toBe(0);
    expect(r.marge).toBe(0);
    expect(r.tauxMarge).toBe(0);
  });
});

describe("réalisé d'une mission", () => {
  it("cumule le CA généré, la marge et les jours facturés depuis les affectations", () => {
    const r = calculMissionRealisee([
      { tjmAchat: "500", tjmVente: "700" },
      { tjmAchat: "520.50", tjmVente: "710.25" },
    ]);

    expect(r.joursFactures).toBe(2);
    expect(r.ca).toBe(1410.25);
    expect(r.marge).toBe(389.75);
  });
});
