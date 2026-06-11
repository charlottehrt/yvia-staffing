import { describe, expect, it } from "vitest";
import { construireSimulation } from "./seed-simulation-data.mjs";

describe("construireSimulation", () => {
  const simulation = construireSimulation(new Date("2026-06-11T12:00:00Z"));

  it("fournit un jeu métier plus complet pour tester les listes et filtres", () => {
    expect(simulation.clients.length).toBeGreaterThanOrEqual(5);
    expect(simulation.freelances.length).toBeGreaterThanOrEqual(5);
    expect(simulation.missions.length).toBeGreaterThanOrEqual(8);
    expect(simulation.projets.length).toBeGreaterThanOrEqual(4);
    expect(simulation.clients.some((client) => client.actif === false)).toBe(true);
    expect(simulation.freelances.some((freelance) => freelance.actif === false)).toBe(true);
    expect(simulation.missions.some((mission) => mission.actif === false)).toBe(true);
  });

  it("couvre le mois courant dans le réalisé et le prévisionnel", () => {
    const recettes = simulation.projets.flatMap((projet) => projet.recettes);
    const couts = simulation.projets.flatMap((projet) => projet.couts);

    expect(recettes).toContainEqual(
      expect.objectContaining({ date: "2026-06-07", statut: "encaisse" })
    );
    expect(recettes).toContainEqual(
      expect.objectContaining({ date: "2026-06-19", statut: "prevu" })
    );
    expect(couts).toContainEqual(
      expect.objectContaining({ date: "2026-06-08", statut: "decaisse" })
    );
    expect(couts).toContainEqual(
      expect.objectContaining({ date: "2026-06-19", statut: "prevu" })
    );
  });

  it("pose du planning freelance du mois courant vers les mois futurs", () => {
    expect(simulation.planning.debut).toBe("2026-06-01");
    expect(simulation.planning.fin).toBe("2026-10-31");
  });
});
