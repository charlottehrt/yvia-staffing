import { describe, it, expect } from "vitest";
import { fusionnerEvenements } from "./evenements";

const recette = (sur: Partial<Parameters<typeof fusionnerEvenements>[0][number]> = {}) => ({
  id: 1,
  date: "2026-03-10",
  montant: "1000",
  libelle: "Acompte" as string | null,
  statut: "encaisse",
  fiabilite: null as string | null,
  ...sur,
});

const cout = (sur: Partial<Parameters<typeof fusionnerEvenements>[1][number]> = {}) => ({
  id: 1,
  date: "2026-03-20",
  montant: "400",
  libelle: null as string | null,
  statut: "decaisse",
  freelanceNom: "Ana Lopez",
  ...sur,
});

const jalon = (sur: Partial<Parameters<typeof fusionnerEvenements>[2][number]> = {}) => ({
  id: 1,
  date: "2026-03-15",
  libelle: "Livraison V1",
  ...sur,
});

describe("fusionnerEvenements (liste chronologique unique du détail projet)", () => {
  it("fusionne les trois types et trie par date croissante", () => {
    const liste = fusionnerEvenements(
      [recette({ id: 1, date: "2026-03-10" })],
      [cout({ id: 2, date: "2026-03-20" })],
      [jalon({ id: 3, date: "2026-03-15" })]
    );
    expect(liste.map((e) => [e.type, e.date])).toEqual([
      ["recette", "2026-03-10"],
      ["jalon", "2026-03-15"],
      ["cout", "2026-03-20"],
    ]);
  });

  it("à date égale, ordonne jalon puis recette puis coût, puis par id", () => {
    const liste = fusionnerEvenements(
      [recette({ id: 5, date: "2026-04-01" })],
      [cout({ id: 2, date: "2026-04-01" }), cout({ id: 1, date: "2026-04-01" })],
      [jalon({ id: 9, date: "2026-04-01" })]
    );
    expect(liste.map((e) => [e.type, e.id])).toEqual([
      ["jalon", 9],
      ["recette", 5],
      ["cout", 1],
      ["cout", 2],
    ]);
  });

  it("donne une clé unique même quand les ids se recoupent entre types", () => {
    const liste = fusionnerEvenements([recette({ id: 7 })], [cout({ id: 7 })], [jalon({ id: 7 })]);
    expect(new Set(liste.map((e) => e.cle)).size).toBe(3);
  });

  it("compose le libellé d'un coût avec le nom du freelance", () => {
    const [sans, avec] = fusionnerEvenements(
      [],
      [
        cout({ id: 1, date: "2026-01-01", libelle: null, freelanceNom: "Ana Lopez" }),
        cout({ id: 2, date: "2026-01-02", libelle: "Sprint 2", freelanceNom: "Ana Lopez" }),
      ],
      []
    );
    expect(sans.libelle).toBe("Ana Lopez");
    expect(avec.libelle).toBe("Ana Lopez · Sprint 2");
  });

  it("remplace le libellé absent d'une recette par une chaîne vide", () => {
    const [e] = fusionnerEvenements([recette({ libelle: null })], [], []);
    expect(e.libelle).toBe("");
  });

  it("marque prévu selon le statut et ne garde la fiabilité que pour une recette prévue", () => {
    const liste = fusionnerEvenements(
      [
        recette({ id: 1, date: "2026-01-01", statut: "prevu", fiabilite: "80" }),
        recette({ id: 2, date: "2026-01-02", statut: "encaisse", fiabilite: "80" }),
      ],
      [cout({ id: 3, date: "2026-01-03", statut: "prevu" })],
      []
    );
    expect(liste.map((e) => [e.prevu, e.fiabilite])).toEqual([
      [true, "80"],
      [false, null],
      [true, null],
    ]);
  });

  it("produit un jalon sans montant et jamais prévu", () => {
    const [e] = fusionnerEvenements([], [], [jalon()]);
    expect(e.montant).toBeNull();
    expect(e.prevu).toBe(false);
    expect(e.libelle).toBe("Livraison V1");
  });
});
