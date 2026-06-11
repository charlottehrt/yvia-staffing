import { fractionFiabilite } from "@/lib/calculs/previsionnel";

type Montant = number | string;

export type AffectationPilotage = {
  date: string;
  tjmAchat: Montant;
  tjmVente: Montant;
  freelanceNom?: string;
  missionNom?: string;
  clientNom?: string;
};

export type EncaissementPilotage = {
  date: string;
  montant: Montant;
  statut: string;
  fiabilite: string | null;
  projetNom?: string;
  clientNom?: string;
  libelle?: string | null;
};

export type DecaissementPilotage = {
  date: string;
  montant: Montant;
  statut: string;
  projetNom?: string;
  clientNom?: string;
  freelanceNom?: string;
  libelle?: string | null;
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
  details: DetailsPrevisionnel;
};

type AccRealise = { ca: number; cout: number };
type AccPrevisionnel = {
  caMax: number;
  caProb: number;
  charges: number;
  details: {
    regie: Map<string, DetailRegiePrevisionnel>;
    encaissements: DetailEncaissementPrevu[];
    decaissements: DetailDecaissementPrevu[];
  };
};

export type DetailRegiePrevisionnel = {
  cle: string;
  freelanceNom: string;
  missionNom: string;
  clientNom: string;
  jours: number;
  caMax: number;
  caProb: number;
  charges: number;
  marge: number;
};

export type DetailEncaissementPrevu = {
  date: string;
  projetNom: string;
  clientNom: string;
  libelle: string | null;
  montant: number;
  montantProbable: number;
  fiabilite: string | null;
};

export type DetailDecaissementPrevu = {
  date: string;
  projetNom: string;
  clientNom: string;
  freelanceNom: string;
  libelle: string | null;
  montant: number;
};

export type DetailsPrevisionnel = {
  regie: DetailRegiePrevisionnel[];
  encaissements: DetailEncaissementPrevu[];
  decaissements: DetailDecaissementPrevu[];
};

const arrondi = (n: number) => Math.round(n * 100) / 100;
const nombre = (n: Montant) => Number(n);
const libelle = (v: string | null | undefined, fallback: string) => v?.trim() || fallback;

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

function creerAccPrevisionnel(): AccPrevisionnel {
  return {
    caMax: 0,
    caProb: 0,
    charges: 0,
    details: {
      regie: new Map(),
      encaissements: [],
      decaissements: [],
    },
  };
}

function detailsPrevisionnel(acc: AccPrevisionnel): DetailsPrevisionnel {
  const regie = Array.from(acc.details.regie.values())
    .sort((a, b) =>
      `${a.freelanceNom}|${a.clientNom}|${a.missionNom}`.localeCompare(
        `${b.freelanceNom}|${b.clientNom}|${b.missionNom}`,
        "fr"
      )
    )
    .map((d) => ({
      ...d,
      caMax: arrondi(d.caMax),
      caProb: arrondi(d.caProb),
      charges: arrondi(d.charges),
      marge: arrondi(d.marge),
    }));

  return {
    regie,
    encaissements: acc.details.encaissements
      .slice()
      .sort((a, b) => `${a.date}|${a.projetNom}`.localeCompare(`${b.date}|${b.projetNom}`, "fr")),
    decaissements: acc.details.decaissements
      .slice()
      .sort((a, b) => `${a.date}|${a.projetNom}`.localeCompare(`${b.date}|${b.projetNom}`, "fr")),
  };
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
    const acc = previsionnel.get(cle) ?? creerAccPrevisionnel();
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
      const montantProbable = montant * fractionFiabilite(e.fiabilite);
      mois.caMax += montant;
      mois.caProb += montantProbable;
      mois.details.encaissements.push({
        date: e.date,
        projetNom: libelle(e.projetNom, "Projet non renseigné"),
        clientNom: libelle(e.clientNom, "Client non renseigné"),
        libelle: e.libelle ?? null,
        montant: arrondi(montant),
        montantProbable: arrondi(montantProbable),
        fiabilite: e.fiabilite,
      });
    }
  }

  for (const d of decaissements) {
    if (d.statut === "decaisse") {
      getRealise(cleMois(d.date)).cout += nombre(d.montant);
    } else if (d.statut === "prevu" && dansFenetre(d.date, debutPrevisionnel, finPrevisionnel)) {
      const mois = getPrevisionnel(cleMois(d.date));
      const montant = nombre(d.montant);
      mois.charges += montant;
      mois.details.decaissements.push({
        date: d.date,
        projetNom: libelle(d.projetNom, "Projet non renseigné"),
        clientNom: libelle(d.clientNom, "Client non renseigné"),
        freelanceNom: libelle(d.freelanceNom, "Freelance non renseigné"),
        libelle: d.libelle ?? null,
        montant: arrondi(montant),
      });
    }
  }

  for (const a of affectations) {
    if (!dansFenetre(a.date, debutPrevisionnel, finPrevisionnel)) continue;
    const mois = getPrevisionnel(cleMois(a.date));
    const ca = nombre(a.tjmVente);
    const charges = nombre(a.tjmAchat);
    mois.caMax += ca;
    mois.caProb += ca;
    mois.charges += charges;

    const freelanceNom = libelle(a.freelanceNom, "Freelance non renseigné");
    const missionNom = libelle(a.missionNom, "Mission non renseignée");
    const clientNom = libelle(a.clientNom, "Client non renseigné");
    const cleDetail = [freelanceNom, missionNom, clientNom, nombre(a.tjmAchat), nombre(a.tjmVente)].join("|");
    const detail =
      mois.details.regie.get(cleDetail) ??
      ({
        cle: cleDetail,
        freelanceNom,
        missionNom,
        clientNom,
        jours: 0,
        caMax: 0,
        caProb: 0,
        charges: 0,
        marge: 0,
      } satisfies DetailRegiePrevisionnel);
    detail.jours += 1;
    detail.caMax += ca;
    detail.caProb += ca;
    detail.charges += charges;
    detail.marge += ca - charges;
    mois.details.regie.set(cleDetail, detail);
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
      const acc = previsionnel.get(cle) ?? creerAccPrevisionnel();
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
        details: detailsPrevisionnel(acc),
      });
    }
  }

  return { realise: lignesRealise, previsionnel: lignesPrevisionnel };
}
