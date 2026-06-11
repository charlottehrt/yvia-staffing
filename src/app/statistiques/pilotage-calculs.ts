import { fractionFiabilite } from "@/lib/calculs/previsionnel";

type Montant = number | string;

export type AffectationPilotage = {
  date: string;
  tjmAchat: Montant;
  tjmVente: Montant;
};

export type EncaissementPilotage = {
  date: string;
  montant: Montant;
  statut: string;
  fiabilite: string | null;
};

export type DecaissementPilotage = {
  date: string;
  montant: Montant;
  statut: string;
};

export type LigneRealise = {
  cle: string;
  annee: number;
  mois: number;
  ca: number;
  cout: number;
  marge: number;
  taux: number;
};

export type LignePrevisionnel = {
  cle: string;
  annee: number;
  mois: number;
  caMax: number;
  caProb: number;
  charges: number;
  margeMax: number;
  margeProb: number;
  cumulMax: number;
  cumulProb: number;
};

type AccRealise = { ca: number; cout: number };
type AccPrevisionnel = { caMax: number; caProb: number; charges: number };

const arrondi = (n: number) => Math.round(n * 100) / 100;
const nombre = (n: Montant) => Number(n);

export function cleMois(date: string) {
  return date.slice(0, 7);
}

function detailsMois(cle: string) {
  const [annee, mois] = cle.split("-").map(Number);
  return { annee, mois };
}

function cleSuivante(cle: string) {
  const { annee, mois } = detailsMois(cle);
  if (mois === 12) return `${annee + 1}-01`;
  return `${annee}-${String(mois + 1).padStart(2, "0")}`;
}

function moisEntre(debut: string, fin: string) {
  const mois: string[] = [];
  for (let cle = debut; cle <= fin; cle = cleSuivante(cle)) mois.push(cle);
  return mois;
}

function dansFenetre(date: string, debut: string, fin: string) {
  return date >= debut && date <= fin;
}

export function calculerPilotageMensuel({
  debutPrevisionnel,
  finPrevisionnel,
  affectations,
  encaissements,
  decaissements,
}: {
  debutPrevisionnel: string;
  finPrevisionnel: string;
  affectations: AffectationPilotage[];
  encaissements: EncaissementPilotage[];
  decaissements: DecaissementPilotage[];
}): { realise: LigneRealise[]; previsionnel: LignePrevisionnel[] } {
  const realise = new Map<string, AccRealise>();
  const previsionnel = new Map<string, AccPrevisionnel>();
  const debutMoisPrevisionnel = cleMois(debutPrevisionnel);
  const finMoisPrevisionnel = cleMois(finPrevisionnel);
  let dernierMoisPrevisionnel = "";

  const getRealise = (cle: string) => {
    const acc = realise.get(cle) ?? { ca: 0, cout: 0 };
    realise.set(cle, acc);
    return acc;
  };
  const getPrevisionnel = (cle: string) => {
    const acc = previsionnel.get(cle) ?? { caMax: 0, caProb: 0, charges: 0 };
    previsionnel.set(cle, acc);
    if (!dernierMoisPrevisionnel || dernierMoisPrevisionnel < cle) dernierMoisPrevisionnel = cle;
    return acc;
  };

  for (const e of encaissements) {
    if (e.statut === "encaisse") {
      getRealise(cleMois(e.date)).ca += nombre(e.montant);
    } else if (e.statut === "prevu" && dansFenetre(e.date, debutPrevisionnel, finPrevisionnel)) {
      const mois = getPrevisionnel(cleMois(e.date));
      const montant = nombre(e.montant);
      mois.caMax += montant;
      mois.caProb += montant * fractionFiabilite(e.fiabilite);
    }
  }

  for (const d of decaissements) {
    if (d.statut === "decaisse") {
      getRealise(cleMois(d.date)).cout += nombre(d.montant);
    } else if (d.statut === "prevu" && dansFenetre(d.date, debutPrevisionnel, finPrevisionnel)) {
      getPrevisionnel(cleMois(d.date)).charges += nombre(d.montant);
    }
  }

  for (const a of affectations) {
    if (!dansFenetre(a.date, debutPrevisionnel, finPrevisionnel)) continue;
    const mois = getPrevisionnel(cleMois(a.date));
    const ca = nombre(a.tjmVente);
    mois.caMax += ca;
    mois.caProb += ca;
    mois.charges += nombre(a.tjmAchat);
  }

  const lignesRealise: LigneRealise[] = Array.from(realise.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([cle, acc]) => {
      const ca = arrondi(acc.ca);
      const cout = arrondi(acc.cout);
      const marge = arrondi(ca - cout);
      return {
        cle,
        ...detailsMois(cle),
        ca,
        cout,
        marge,
        taux: ca > 0 ? marge / ca : 0,
      };
    });

  const lignesPrevisionnel: LignePrevisionnel[] = [];
  if (dernierMoisPrevisionnel) {
    const fin = dernierMoisPrevisionnel < finMoisPrevisionnel ? dernierMoisPrevisionnel : finMoisPrevisionnel;
    let cumulMax = 0;
    let cumulProb = 0;
    for (const cle of moisEntre(debutMoisPrevisionnel, fin)) {
      const acc = previsionnel.get(cle) ?? { caMax: 0, caProb: 0, charges: 0 };
      const margeMax = acc.caMax - acc.charges;
      const margeProb = acc.caProb - acc.charges;
      cumulMax += margeMax;
      cumulProb += margeProb;
      lignesPrevisionnel.push({
        cle,
        ...detailsMois(cle),
        caMax: arrondi(acc.caMax),
        caProb: arrondi(acc.caProb),
        charges: arrondi(acc.charges),
        margeMax: arrondi(margeMax),
        margeProb: arrondi(margeProb),
        cumulMax: arrondi(cumulMax),
        cumulProb: arrondi(cumulProb),
      });
    }
  }

  return { realise: lignesRealise, previsionnel: lignesPrevisionnel };
}
