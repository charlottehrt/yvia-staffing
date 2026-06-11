import { describe, expect, test } from "vitest";
import {
  estProjetDansFluxActif,
  estProjetTermineOuPerdu,
  labelStatutCommercial,
  normaliserStatutCommercial,
} from "./statut-commercial";

describe("statut commercial projet", () => {
  test("normalise les valeurs inconnues vers a_qualifier", () => {
    expect(normaliserStatutCommercial("en_discussion")).toBe("en_discussion");
    expect(normaliserStatutCommercial("")).toBe("a_qualifier");
    expect(normaliserStatutCommercial("ancien-statut")).toBe("a_qualifier");
    expect(normaliserStatutCommercial(null)).toBe("a_qualifier");
  });

  test("expose les libelles affichables", () => {
    expect(labelStatutCommercial("a_qualifier")).toBe("À qualifier");
    expect(labelStatutCommercial("proposition_envoyee")).toBe("Proposition envoyée");
    expect(labelStatutCommercial("perdu")).toBe("Perdu");
  });

  test("classe les projets actifs hors perdu dans le flux actif", () => {
    expect(estProjetDansFluxActif({ actif: true, statutCommercial: "gagne" })).toBe(true);
    expect(estProjetDansFluxActif({ actif: true, statutCommercial: "a_qualifier" })).toBe(true);
    expect(estProjetDansFluxActif({ actif: true, statutCommercial: "perdu" })).toBe(false);
    expect(estProjetDansFluxActif({ actif: false, statutCommercial: "gagne" })).toBe(false);
  });

  test("classe les projets termines ou perdus ensemble", () => {
    expect(estProjetTermineOuPerdu({ actif: false, statutCommercial: "gagne" })).toBe(true);
    expect(estProjetTermineOuPerdu({ actif: true, statutCommercial: "perdu" })).toBe(true);
    expect(estProjetTermineOuPerdu({ actif: false, statutCommercial: "perdu" })).toBe(true);
    expect(estProjetTermineOuPerdu({ actif: true, statutCommercial: "en_discussion" })).toBe(false);
  });
});
