import { describe, expect, it } from "vitest";
import { calculerPilotageMensuel } from "./pilotage-calculs";

describe("calculerPilotageMensuel", () => {
  it("place le mois courant dans le réalisé et le prévisionnel selon le statut", () => {
    const resultat = calculerPilotageMensuel({
      debutPrevisionnel: "2026-06-01",
      finPrevisionnel: "2026-08-31",
      affectations: [{ date: "2026-06-12", tjmAchat: 500, tjmVente: 800 }],
      encaissements: [
        { date: "2026-06-10", montant: 1000, statut: "encaisse", fiabilite: null },
        { date: "2026-06-20", montant: 2000, statut: "prevu", fiabilite: "50" },
      ],
      decaissements: [
        { date: "2026-06-09", montant: 300, statut: "decaisse" },
        { date: "2026-06-25", montant: 400, statut: "prevu" },
      ],
    });

    expect(resultat.realise).toEqual([
      { cle: "2026-06", annee: 2026, mois: 6, ca: 1000, cout: 300, marge: 700, taux: 0.7 },
    ]);
    expect(resultat.previsionnel[0]).toMatchObject({
      cle: "2026-06",
      caMax: 2800,
      caProb: 1800,
      charges: 900,
      margeMax: 1900,
      margeProb: 900,
      cumulProb: 900,
    });
  });

  it("garde les mois futurs vides entre le mois courant et le dernier mois avec données", () => {
    const resultat = calculerPilotageMensuel({
      debutPrevisionnel: "2026-06-01",
      finPrevisionnel: "2026-09-30",
      affectations: [],
      encaissements: [{ date: "2026-09-05", montant: 1200, statut: "prevu", fiabilite: "100" }],
      decaissements: [],
    });

    expect(resultat.previsionnel.map((l) => l.cle)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });
});
