import { describe, it, expect } from "vitest";
import {
  moisDeAnnee,
  moisActif,
  construireTableauCharges,
  type ChargeFixe,
} from "./calculs";

describe("moisDeAnnee", () => {
  it("renvoie les 12 mois de l'année au format AAAA-MM", () => {
    const mois = moisDeAnnee(2026);
    expect(mois).toHaveLength(12);
    expect(mois[0]).toBe("2026-01");
    expect(mois[11]).toBe("2026-12");
  });
});

describe("moisActif", () => {
  it("exclut les mois avant la date de début", () => {
    expect(moisActif({ dateDebut: "2026-03-15", dateFin: null }, "2026-02")).toBe(false);
    expect(moisActif({ dateDebut: "2026-03-15", dateFin: null }, "2026-03")).toBe(true);
  });

  it("exclut les mois après la date de fin", () => {
    expect(moisActif({ dateDebut: "2026-01-01", dateFin: "2026-08-31" }, "2026-08")).toBe(true);
    expect(moisActif({ dateDebut: "2026-01-01", dateFin: "2026-08-31" }, "2026-09")).toBe(false);
  });

  it("reste actif indéfiniment sans date de fin", () => {
    expect(moisActif({ dateDebut: "2020-01-01", dateFin: null }, "2030-12")).toBe(true);
  });
});

const charge = (over: Partial<ChargeFixe> = {}): ChargeFixe => ({
  id: 1,
  libelle: "Notion",
  montantMensuel: "49",
  dateDebut: "2026-01-01",
  dateFin: null,
  actif: true,
  ...over,
});

describe("construireTableauCharges", () => {
  it("applique le montant récurrent à chaque mois actif", () => {
    const t = construireTableauCharges({
      charges: [charge({ dateDebut: "2026-03-15" })],
      valeurs: [],
      annee: 2026,
    });
    const ligne = t.lignes[0];
    // Janvier et février sont avant le début : pas de montant.
    expect(ligne.cellules[0].montant).toBeNull();
    expect(ligne.cellules[1].montant).toBeNull();
    // De mars à décembre : 49 € (10 mois).
    expect(ligne.cellules[2].montant).toBe(49);
    expect(ligne.cellules[11].montant).toBe(49);
    expect(ligne.total).toBe(490);
  });

  it("remplace le montant récurrent par la valeur ponctuelle saisie", () => {
    const t = construireTableauCharges({
      charges: [charge()],
      valeurs: [{ chargeFixeId: 1, mois: "2026-06", montant: "588" }],
      annee: 2026,
    });
    const ligne = t.lignes[0];
    expect(ligne.cellules[5].montant).toBe(588); // juin : facturation annuelle
    expect(ligne.cellules[5].saisie).toBe(588);
    expect(ligne.cellules[4].montant).toBe(49); // mai : récurrent
    expect(ligne.cellules[4].saisie).toBeNull();
    // 11 × 49 + 588 = 1127
    expect(ligne.total).toBe(1127);
  });

  it("respecte une saisie ponctuelle à 0 (mois non payé)", () => {
    const t = construireTableauCharges({
      charges: [charge()],
      valeurs: [{ chargeFixeId: 1, mois: "2026-08", montant: "0" }],
      annee: 2026,
    });
    const ligne = t.lignes[0];
    expect(ligne.cellules[7].montant).toBe(0);
    expect(ligne.cellules[7].saisie).toBe(0);
    expect(ligne.total).toBe(49 * 11); // août à 0
  });

  it("ignore les mois après la date de fin (abonnement résilié)", () => {
    const t = construireTableauCharges({
      charges: [charge({ dateFin: "2026-04-30" })],
      valeurs: [],
      annee: 2026,
    });
    const ligne = t.lignes[0];
    expect(ligne.cellules[3].montant).toBe(49); // avril
    expect(ligne.cellules[4].montant).toBeNull(); // mai
    expect(ligne.total).toBe(49 * 4);
  });

  it("totalise par mois et sur l'année, toutes charges confondues", () => {
    const t = construireTableauCharges({
      charges: [
        charge({ id: 1, montantMensuel: "49" }),
        charge({ id: 2, libelle: "Figma", montantMensuel: "12" }),
      ],
      valeurs: [],
      annee: 2026,
    });
    // Chaque mois : 49 + 12 = 61.
    expect(t.totauxMois[0]).toBe(61);
    expect(t.totauxMois.every((m) => m === 61)).toBe(true);
    expect(t.totalGeneral).toBe(61 * 12);
  });

  it("évite les artefacts de flottants", () => {
    const t = construireTableauCharges({
      charges: [charge({ montantMensuel: "0.1" }), charge({ id: 2, montantMensuel: "0.2" })],
      valeurs: [],
      annee: 2026,
    });
    expect(t.totauxMois[0]).toBe(0.3);
  });
});
