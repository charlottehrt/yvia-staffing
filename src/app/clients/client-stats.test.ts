import { describe, expect, test } from "vitest";

import { calculerStatsClients } from "./client-stats";

describe("calculerStatsClients", () => {
  test("cumule le CA total, le CA du mois et la marge totale par client", () => {
    const stats = calculerStatsClients({
      debutMois: "2026-06-01",
      finMois: "2026-06-30",
      regie: [
        { clientId: 1, date: "2026-06-03", tjmVente: "700", tjmAchat: "500" },
        { clientId: 1, date: "2026-05-29", tjmVente: "650", tjmAchat: "450" },
        { clientId: 2, date: "2026-06-08", tjmVente: "900", tjmAchat: "600" },
      ],
      encaissements: [
        { clientId: 1, date: "2026-06-10", montant: "4000" },
        { clientId: 1, date: "2026-02-01", montant: "1000" },
      ],
      decaissements: [
        { clientId: 1, date: "2026-06-12", montant: "1800" },
        { clientId: 1, date: "2026-03-01", montant: "300" },
        { clientId: 2, date: "2026-06-12", montant: "1000" },
      ],
    });

    expect(stats.get(1)).toEqual({
      caTotal: 6350,
      caMois: 4700,
      margeTotale: 3300,
    });
    expect(stats.get(2)).toEqual({
      caTotal: 900,
      caMois: 900,
      margeTotale: -700,
    });
  });

  test("arrondit les montants au centime", () => {
    const stats = calculerStatsClients({
      debutMois: "2026-06-01",
      finMois: "2026-06-30",
      regie: [{ clientId: 1, date: "2026-06-03", tjmVente: "100.335", tjmAchat: "40.111" }],
      encaissements: [{ clientId: 1, date: "2026-05-01", montant: "200.335" }],
      decaissements: [{ clientId: 1, date: "2026-05-02", montant: "10.111" }],
    });

    expect(stats.get(1)).toEqual({
      caTotal: 300.67,
      caMois: 100.34,
      margeTotale: 250.45,
    });
  });
});
