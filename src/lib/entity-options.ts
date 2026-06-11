export type ClientOptionLocal = { id: number; nom: string };
export type FreelanceOptionLocal = { id: number; prenom: string; nom: string };
export type MissionPlanningLocal = {
  id: number;
  nom: string;
  freelanceId: number;
  clientNom: string;
};

function ajouterUniqueParId<T extends { id: number }>(options: T[], item: T): T[] {
  return options.some((option) => option.id === item.id) ? options : [...options, item];
}

export function ajouterClientLocal(options: ClientOptionLocal[], client: ClientOptionLocal) {
  return { options: ajouterUniqueParId(options, client), selectedId: String(client.id) };
}

export function ajouterFreelanceLocal(
  options: FreelanceOptionLocal[],
  freelance: FreelanceOptionLocal
) {
  return { options: ajouterUniqueParId(options, freelance), selectedId: String(freelance.id) };
}

export function ajouterMissionPlanningLocal<
  T extends {
    id: number;
    missions: Array<{ id: number; nom: string; clientNom: string; couleur: TCouleur }>;
  },
  TCouleur,
>(
  lignes: T[],
  mission: MissionPlanningLocal,
  couleur: TCouleur = { bg: "#0571ed", fg: "#ffffff" } as TCouleur
): T[] {
  return lignes.map((ligne) =>
    ligne.id === mission.freelanceId
      ? {
          ...ligne,
          missions: ligne.missions.some((m) => m.id === mission.id)
            ? ligne.missions
            : [
                ...ligne.missions,
                {
                  id: mission.id,
                  nom: mission.nom,
                  clientNom: mission.clientNom,
                  couleur,
                },
              ],
        }
      : ligne
  );
}
