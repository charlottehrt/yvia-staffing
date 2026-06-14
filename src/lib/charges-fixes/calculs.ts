// Logique de calcul des charges fixes (dépenses récurrentes, ex : abonnements SaaS).
//
// Le montant d'une charge pour un mois donné suit cette cascade :
//   1. vide si le mois est hors de la période [date de début, date de fin] ;
//   2. sinon le montant saisi pour ce mois précis (valeur ponctuelle), s'il existe ;
//   3. sinon le montant mensuel récurrent de la charge.
//
// Une saisie ponctuelle à 0 est respectée (mois non payé) : on distingue bien
// « aucune saisie » (= on retombe sur le montant récurrent) de « saisie à 0 ».

const pad2 = (n: number) => String(n).padStart(2, "0");

// Liste des 12 mois "AAAA-MM" d'une année (janvier → décembre).
export function moisDeAnnee(annee: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${annee}-${pad2(i + 1)}`);
}

export type ChargeFixe = {
  id: number;
  libelle: string;
  montantMensuel: string | number;
  dateDebut: string; // "AAAA-MM-JJ"
  dateFin: string | null; // "AAAA-MM-JJ" | null (vide = toujours en cours)
  actif: boolean;
};

export type ValeurMensuelle = {
  chargeFixeId: number;
  mois: string; // "AAAA-MM"
  montant: string | number;
};

export type CelluleCharge = {
  mois: string; // "AAAA-MM"
  active: boolean; // le mois est dans la période de la charge
  defaut: number; // montant récurrent de la charge
  saisie: number | null; // montant ponctuel saisi pour ce mois, sinon null
  montant: number | null; // montant effectif (null si le mois est inactif)
};

export type LigneCharge = {
  id: number;
  libelle: string;
  montantMensuel: number;
  dateDebut: string;
  dateFin: string | null;
  actif: boolean;
  cellules: CelluleCharge[]; // une par mois de l'année
  total: number; // somme des montants effectifs sur l'année
};

export type TableauCharges = {
  annee: number;
  mois: string[]; // 12 mois "AAAA-MM"
  lignes: LigneCharge[];
  totauxMois: number[]; // total par mois, toutes charges confondues
  totalGeneral: number; // total de l'année
};

const nombre = (v: string | number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

// Le mois "AAAA-MM" est-il dans la période [début, fin] de la charge ?
// La comparaison lexicographique de chaînes "AAAA-MM" suffit (format zéro-padé).
export function moisActif(
  charge: { dateDebut: string; dateFin: string | null },
  mois: string
): boolean {
  if (mois < charge.dateDebut.slice(0, 7)) return false;
  if (charge.dateFin && mois > charge.dateFin.slice(0, 7)) return false;
  return true;
}

// Construit la grille charges × mois pour une année, avec les totaux.
export function construireTableauCharges({
  charges,
  valeurs,
  annee,
}: {
  charges: ChargeFixe[];
  valeurs: ValeurMensuelle[];
  annee: number;
}): TableauCharges {
  const mois = moisDeAnnee(annee);

  // Index des valeurs ponctuelles : chargeId -> (mois -> montant).
  const parCharge = new Map<number, Map<string, number>>();
  for (const v of valeurs) {
    const m = parCharge.get(v.chargeFixeId) ?? new Map<string, number>();
    m.set(v.mois, nombre(v.montant));
    parCharge.set(v.chargeFixeId, m);
  }

  const totauxMois = new Array<number>(12).fill(0);

  const lignes: LigneCharge[] = charges.map((charge) => {
    const defaut = nombre(charge.montantMensuel);
    const saisies = parCharge.get(charge.id);
    let total = 0;

    const cellules: CelluleCharge[] = mois.map((m, i) => {
      const active = moisActif(charge, m);
      const saisie = saisies?.has(m) ? saisies.get(m)! : null;
      // `?? defaut` ne s'applique qu'à null/undefined : une saisie à 0 reste 0.
      const montant = active ? saisie ?? defaut : null;
      if (montant !== null) {
        total += montant;
        totauxMois[i] += montant;
      }
      return { mois: m, active, defaut, saisie, montant };
    });

    return {
      id: charge.id,
      libelle: charge.libelle,
      montantMensuel: defaut,
      dateDebut: charge.dateDebut,
      dateFin: charge.dateFin,
      actif: charge.actif,
      cellules: cellules.map((c) => ({
        ...c,
        montant: c.montant === null ? null : arrondi(c.montant),
      })),
      total: arrondi(total),
    };
  });

  return {
    annee,
    mois,
    lignes,
    totauxMois: totauxMois.map(arrondi),
    totalGeneral: arrondi(totauxMois.reduce((s, v) => s + v, 0)),
  };
}
