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

  it("detaille un mois previsionnel par freelance, encaissements et decaissements prevus", () => {
    const resultat = calculerPilotageMensuel({
      debutPrevisionnel: "2026-06-01",
      finPrevisionnel: "2026-06-30",
      affectations: [
        {
          date: "2026-06-03",
          tjmAchat: 500,
          tjmVente: 800,
          freelanceNom: "Ada Lovelace",
          missionNom: "Refonte CRM",
          clientNom: "ACME",
        },
        {
          date: "2026-06-04",
          tjmAchat: 500,
          tjmVente: 800,
          freelanceNom: "Ada Lovelace",
          missionNom: "Refonte CRM",
          clientNom: "ACME",
        },
      ],
      encaissements: [
        {
          date: "2026-06-15",
          montant: 10000,
          statut: "prevu",
          fiabilite: "80",
          projetNom: "Forfait Data",
          clientNom: "Globex",
          libelle: "Acompte",
        },
      ],
      decaissements: [
        {
          date: "2026-06-20",
          montant: 3000,
          statut: "prevu",
          projetNom: "Forfait Data",
          clientNom: "Globex",
          freelanceNom: "Grace Hopper",
          libelle: "Sprint 1",
        },
      ],
    });

    expect(resultat.previsionnel[0].details.regie).toEqual([
      {
        cle: "Ada Lovelace|Refonte CRM|ACME|500|800",
        freelanceNom: "Ada Lovelace",
        missionNom: "Refonte CRM",
        clientNom: "ACME",
        jours: 2,
        caMax: 1600,
        caProb: 1600,
        charges: 1000,
        marge: 600,
      },
    ]);
    expect(resultat.previsionnel[0].details.encaissements).toEqual([
      {
        date: "2026-06-15",
        projetNom: "Forfait Data",
        clientNom: "Globex",
        libelle: "Acompte",
        montant: 10000,
        montantProbable: 8000,
        fiabilite: "80",
      },
    ]);
    expect(resultat.previsionnel[0].details.decaissements).toEqual([
      {
        date: "2026-06-20",
        projetNom: "Forfait Data",
        clientNom: "Globex",
        freelanceNom: "Grace Hopper",
        libelle: "Sprint 1",
        montant: 3000,
      },
    ]);
  });
});
