import { describe, it, expect, vi, beforeEach } from "vitest";

// Régression sécurité : aucune Server Action de mutation ne doit toucher la base
// quand la session est absente. On mocke getSession pour qu'il renvoie toujours
// null (= visiteur non authentifié), et la base pour qu'elle EXPLOSE si on l'atteint.
// Si une action oublie sa garde, elle appellera `db` et le test échouera.

// vi.hoisted : la fabrique de vi.mock est remontée en haut du fichier, donc la
// référence à getSession doit l'être aussi pour être définie au moment du mock.
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/auth/server", () => ({ getSession }));

// Toute lecture sur `db` (db.insert, db.select, db.transaction…) lève une erreur :
// une action correctement gardée court-circuite avant d'y arriver.
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get() {
        throw new Error("La base ne doit pas être touchée sans session authentifiée.");
      },
    }
  ),
}));

// revalidatePath n'est appelé qu'après les écritures : un no-op suffit ici.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import * as clients from "./clients/actions";
import * as freelances from "./freelances/actions";
import * as missions from "./missions/actions";
import * as projets from "./projets/actions";
import * as planning from "./planning-actions";

beforeEach(() => {
  getSession.mockReset();
  getSession.mockResolvedValue(null); // visiteur non authentifié
});

// Actions prenant un FormData (la grande majorité).
const actionsFormData: Array<[string, (fd: FormData) => Promise<{ ok: boolean; message?: string }>]> = [
  ["clients.creerClient", clients.creerClient],
  ["clients.modifierClient", clients.modifierClient],
  ["clients.basculerActifClient", clients.basculerActifClient],
  ["freelances.creerFreelance", freelances.creerFreelance],
  ["freelances.modifierFreelance", freelances.modifierFreelance],
  ["freelances.basculerActif", freelances.basculerActif],
  ["missions.creerMission", missions.creerMission],
  ["missions.modifierMission", missions.modifierMission],
  ["missions.basculerActifMission", missions.basculerActifMission],
  ["projets.creerProjet", projets.creerProjet],
  ["projets.modifierProjet", projets.modifierProjet],
  ["projets.basculerActifProjet", projets.basculerActifProjet],
  ["projets.ajouterEncaissement", projets.ajouterEncaissement],
  ["projets.supprimerEncaissement", projets.supprimerEncaissement],
  ["projets.ajouterDecaissement", projets.ajouterDecaissement],
  ["projets.supprimerDecaissement", projets.supprimerDecaissement],
  ["projets.marquerEncaissementRealise", projets.marquerEncaissementRealise],
  ["projets.marquerDecaissementRealise", projets.marquerDecaissementRealise],
  ["projets.definirFiabiliteClient", projets.definirFiabiliteClient],
  ["projets.definirFiabiliteProjet", projets.definirFiabiliteProjet],
  ["projets.ajouterJalon", projets.ajouterJalon],
  ["projets.supprimerJalon", projets.supprimerJalon],
];

describe("Server Actions (FormData) : rejet sans session", () => {
  it.each(actionsFormData)("%s refuse et ne touche pas la base", async (_nom, action) => {
    const res = await action(new FormData());
    expect(res.ok).toBe(false);
    expect(res.message).toBe("Vous n'êtes pas connecté.");
    expect(getSession).toHaveBeenCalledOnce();
  });
});

// Actions du planning : arguments positionnels (pas de FormData).
describe("Server Actions (planning) : rejet sans session", () => {
  it("affecterJours refuse et ne touche pas la base", async () => {
    const res = await planning.affecterJours(1, 1, ["2026-06-10"]);
    expect(res).toEqual({ ok: false, message: "Vous n'êtes pas connecté." });
  });

  it("etendreAuMoisSuivant refuse et ne touche pas la base", async () => {
    const res = await planning.etendreAuMoisSuivant(2026, 6);
    expect(res).toEqual({ ok: false, message: "Vous n'êtes pas connecté." });
  });

  it("modifierTjmAffectation refuse et ne touche pas la base", async () => {
    const res = await planning.modifierTjmAffectation(1, "2026-06-10", "500", "650");
    expect(res).toEqual({ ok: false, message: "Vous n'êtes pas connecté." });
  });

  it("libererJours refuse et ne touche pas la base", async () => {
    const res = await planning.libererJours(1, ["2026-06-10"]);
    expect(res).toEqual({ ok: false, message: "Vous n'êtes pas connecté." });
  });
});
