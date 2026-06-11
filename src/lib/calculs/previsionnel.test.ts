import { describe, it, expect } from "vitest";
import {
  normaliserFiabiliteEcheance,
  resoudreFiabilite,
  probaDe,
  FIABILITE_DEFAUT,
  calculPrevisionnelProjet,
} from "./previsionnel";

describe("resoudreFiabilite (cascade échéance -> projet -> client -> filet)", () => {
  it("prend la fiabilité de l'échéance en priorité", () => {
    expect(resoudreFiabilite("arisque", "probable", "securise")).toBe("arisque");
  });

  it("retombe sur le projet si l'échéance est vide", () => {
    expect(resoudreFiabilite(null, "incertain", "securise")).toBe("incertain");
  });

  it("retombe sur le client si échéance et projet sont vides", () => {
    expect(resoudreFiabilite(null, null, "securise")).toBe("securise");
  });

  it("utilise le filet global quand rien n'est renseigné", () => {
    expect(resoudreFiabilite(null, null, null)).toBe(FIABILITE_DEFAUT);
  });

  it("ignore les valeurs invalides et continue la cascade", () => {
    expect(resoudreFiabilite("nimporte", null, "probable")).toBe("probable");
  });
});

describe("probaDe", () => {
  it("renvoie la probabilité du barème", () => {
    expect(probaDe("securise")).toBe(0.95);
    expect(probaDe("arisque")).toBe(0.25);
  });
});

describe("calculPrevisionnelProjet (exemple de la spec, projet APG)", () => {
  // 20000 encaissé + 25000 prévu Probable (75%) + 15000 prévu Incertain (50%)
  // Coûts : 14000 réalisés + 14000 prévus = 28000.
  const recettes = [
    { montant: 20000, statut: "encaisse", fiabilite: null },
    { montant: 25000, statut: "prevu", fiabilite: "probable" },
    { montant: 15000, statut: "prevu", fiabilite: "incertain" },
  ];
  const couts = [
    { montant: 14000, statut: "decaisse" },
    { montant: 14000, statut: "prevu" },
  ];
  const r = calculPrevisionnelProjet(recettes, couts, null, "probable");

  it("CA : optimiste / pondéré / sécurisé", () => {
    expect(r.caOptimiste).toBe(60000);
    expect(r.caPondere).toBe(46250);
    expect(r.caSecurise).toBe(20000); // aucune recette prévue n'est "Sécurisé"
  });

  it("coût total compté à 100 %", () => {
    expect(r.coutTotal).toBe(28000);
  });

  it("marge pondérée = CA pondéré - coût", () => {
    expect(r.margePondere).toBe(18250);
    expect(r.margeSecurise).toBe(-8000); // le pire cas est déficitaire
  });

  it("la fiabilité de l'échéance prime sur la cascade", () => {
    const seul = calculPrevisionnelProjet(
      [{ montant: 1000, statut: "prevu", fiabilite: "securise" }],
      [],
      "arisque",
      "arisque"
    );
    expect(seul.caPondere).toBe(950); // 1000 × 0,95, pas × 0,25
  });
});

describe("normaliserFiabiliteEcheance (saisie du formulaire de recette)", () => {
  it("accepte un pourcentage 0-100 (stocké en texte, espaces tolérés)", () => {
    expect(normaliserFiabiliteEcheance("80")).toBe("80");
    expect(normaliserFiabiliteEcheance(" 37.5 ")).toBe("37.5");
    expect(normaliserFiabiliteEcheance("0")).toBe("0");
    expect(normaliserFiabiliteEcheance("100")).toBe("100");
  });

  it("accepte une ancienne catégorie (rétrocompatibilité)", () => {
    expect(normaliserFiabiliteEcheance("probable")).toBe("probable");
  });

  it("rejette tout le reste vers null (la cascade projet/client décide)", () => {
    expect(normaliserFiabiliteEcheance("")).toBeNull();
    expect(normaliserFiabiliteEcheance(null)).toBeNull();
    expect(normaliserFiabiliteEcheance(undefined)).toBeNull();
    expect(normaliserFiabiliteEcheance("150")).toBeNull();
    expect(normaliserFiabiliteEcheance("-5")).toBeNull();
    expect(normaliserFiabiliteEcheance("abc")).toBeNull();
  });
});
