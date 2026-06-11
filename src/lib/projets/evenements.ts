// Fusion des recettes, coûts et jalons d'un projet en une liste d'événements
// unique, lue chronologiquement dans le drawer de détail.

export type TypeEvenement = "recette" | "cout" | "jalon";

export type RecetteEcheance = {
  id: number;
  date: string;
  montant: string;
  libelle: string | null;
  statut: string;
  fiabilite: string | null;
};

export type CoutEcheance = {
  id: number;
  date: string;
  montant: string;
  libelle: string | null;
  statut: string;
  freelanceNom: string;
};

export type JalonEcheance = { id: number; date: string; libelle: string };

export type EvenementProjet = {
  type: TypeEvenement;
  id: number;
  cle: string; // clé React unique inter-types ("recette-3", "jalon-3"...)
  date: string;
  libelle: string;
  montant: string | null; // null pour un jalon (pas d'impact financier)
  prevu: boolean;
  fiabilite: string | null; // renseignée uniquement pour une recette prévue
};

// À date égale, le jalon (repère du jour) s'affiche avant l'argent.
const ORDRE_TYPE: Record<TypeEvenement, number> = { jalon: 0, recette: 1, cout: 2 };

const estPrevu = (statut: string) => statut === "prevu";

export function fusionnerEvenements(
  recettes: RecetteEcheance[],
  couts: CoutEcheance[],
  jalons: JalonEcheance[]
): EvenementProjet[] {
  const evenements: EvenementProjet[] = [
    ...recettes.map((r) => ({
      type: "recette" as const,
      id: r.id,
      cle: `recette-${r.id}`,
      date: r.date,
      libelle: r.libelle ?? "",
      montant: r.montant,
      prevu: estPrevu(r.statut),
      fiabilite: estPrevu(r.statut) ? r.fiabilite : null,
    })),
    ...couts.map((c) => ({
      type: "cout" as const,
      id: c.id,
      cle: `cout-${c.id}`,
      date: c.date,
      libelle: `${c.freelanceNom}${c.libelle ? ` · ${c.libelle}` : ""}`,
      montant: c.montant,
      prevu: estPrevu(c.statut),
      fiabilite: null,
    })),
    ...jalons.map((j) => ({
      type: "jalon" as const,
      id: j.id,
      cle: `jalon-${j.id}`,
      date: j.date,
      libelle: j.libelle,
      montant: null,
      prevu: false,
      fiabilite: null,
    })),
  ];

  return evenements.sort(
    (a, b) =>
      a.date.localeCompare(b.date) || ORDRE_TYPE[a.type] - ORDRE_TYPE[b.type] || a.id - b.id
  );
}
