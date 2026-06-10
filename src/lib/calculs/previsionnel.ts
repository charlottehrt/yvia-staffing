// Barème et logique du prévisionnel pondéré (spec : .context/previsionnel-logique.md).
// Une probabilité de paiement (catégorie de fiabilité) pondère l'argent PAS ENCORE
// reçu d'un client. L'argent déjà encaissé, lui, est certain (100 %).

// Catégories de fiabilité, de la plus sûre à la plus risquée.
export type Fiabilite = "securise" | "probable" | "incertain" | "arisque";

// Barème modifiable : à chaque catégorie sa probabilité (0 à 1) et son libellé.
export const FIABILITES: { key: Fiabilite; label: string; proba: number }[] = [
  { key: "securise", label: "Sécurisé", proba: 0.95 },
  { key: "probable", label: "Probable", proba: 0.75 },
  { key: "incertain", label: "Incertain", proba: 0.5 },
  { key: "arisque", label: "À risque", proba: 0.25 },
];

// Filet de sécurité global quand rien n'est renseigné (peut évoluer).
export const FIABILITE_DEFAUT: Fiabilite = "probable";

const PAR_KEY = new Map(FIABILITES.map((f) => [f.key, f]));

// Vrai si la valeur est une catégorie connue (utile pour valider une saisie).
export function estFiabilite(v: unknown): v is Fiabilite {
  return typeof v === "string" && PAR_KEY.has(v as Fiabilite);
}

// Libellé lisible d'une catégorie.
export function labelFiabilite(key: Fiabilite): string {
  return PAR_KEY.get(key)?.label ?? key;
}

// Probabilité (0 à 1) d'une catégorie.
export function probaDe(key: Fiabilite): number {
  return PAR_KEY.get(key)?.proba ?? 0;
}

// Cascade de résolution : on prend la première valeur renseignée, dans l'ordre
// échéance -> projet -> client, sinon le filet global.
export function resoudreFiabilite(
  echeance: string | null,
  projet: string | null,
  client: string | null
): Fiabilite {
  for (const v of [echeance, projet, client]) {
    if (estFiabilite(v)) return v;
  }
  return FIABILITE_DEFAUT;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;
const estPrevu = (x: { statut: string }) => x.statut === "prevu";

export type Recette = { montant: number; statut: string; fiabilite: string | null };
export type Cout = { montant: number; statut: string };

export type PrevisionnelProjet = {
  encaisse: number; // recettes déjà reçues (certaines)
  caOptimiste: number; // encaissé + tout le prévu
  caPondere: number; // encaissé + prévu × proba
  caSecurise: number; // encaissé + prévu noté "Sécurisé"
  coutTotal: number; // coûts réalisés + prévus (comptés à 100 %)
  margeOptimiste: number;
  margePondere: number;
  margeSecurise: number;
};

// Calcul des 3 scénarios pour un projet (spec section 3). Les recettes prévues sont
// pondérées par leur fiabilité résolue ; les coûts comptent toujours à 100 % (prudent).
export function calculPrevisionnelProjet(
  recettes: Recette[],
  couts: Cout[],
  projetFiabilite: string | null,
  clientFiabilite: string | null
): PrevisionnelProjet {
  const encaisse = recettes.filter((r) => !estPrevu(r)).reduce((s, r) => s + r.montant, 0);

  let prevuOptimiste = 0;
  let prevuPondere = 0;
  let prevuSecurise = 0;
  for (const r of recettes.filter(estPrevu)) {
    const cat = resoudreFiabilite(r.fiabilite, projetFiabilite, clientFiabilite);
    prevuOptimiste += r.montant;
    prevuPondere += r.montant * probaDe(cat);
    if (cat === "securise") prevuSecurise += r.montant;
  }

  const coutTotal = couts.reduce((s, c) => s + c.montant, 0);
  const caOptimiste = arrondi(encaisse + prevuOptimiste);
  const caPondere = arrondi(encaisse + prevuPondere);
  const caSecurise = arrondi(encaisse + prevuSecurise);

  return {
    encaisse: arrondi(encaisse),
    caOptimiste,
    caPondere,
    caSecurise,
    coutTotal: arrondi(coutTotal),
    margeOptimiste: arrondi(caOptimiste - coutTotal),
    margePondere: arrondi(caPondere - coutTotal),
    margeSecurise: arrondi(caSecurise - coutTotal),
  };
}
