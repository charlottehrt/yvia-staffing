import { describe, expect, test } from "vitest";
import {
  ajouterClientLocal,
  ajouterFreelanceLocal,
  ajouterMissionPlanningLocal,
} from "./entity-options";

describe("entity option helpers", () => {
  test("ajoute un client sans doublon et selectionne son id", () => {
    const resultat = ajouterClientLocal([{ id: 1, nom: "Acme" }], { id: 2, nom: "Beta" });

    expect(resultat.options).toEqual([
      { id: 1, nom: "Acme" },
      { id: 2, nom: "Beta" },
    ]);
    expect(resultat.selectedId).toBe("2");
  });

  test("ne duplique pas un freelance deja present", () => {
    const resultat = ajouterFreelanceLocal(
      [{ id: 1, prenom: "Ada", nom: "Lovelace" }],
      { id: 1, prenom: "Ada", nom: "Lovelace" }
    );

    expect(resultat.options).toEqual([{ id: 1, prenom: "Ada", nom: "Lovelace" }]);
    expect(resultat.selectedId).toBe("1");
  });

  test("ajoute une mission au bon freelance dans le planning", () => {
    const lignes = [
      { id: 7, nom: "Ada Lovelace", missions: [], cellules: {} },
      { id: 8, nom: "Grace Hopper", missions: [], cellules: {} },
    ];

    const resultat = ajouterMissionPlanningLocal(lignes, {
      id: 12,
      nom: "Audit",
      freelanceId: 7,
      clientNom: "Acme",
    });

    expect(resultat[0].missions).toEqual([
      { id: 12, nom: "Audit", clientNom: "Acme", couleur: expect.any(Object) },
    ]);
    expect(resultat[1].missions).toEqual([]);
  });
});
