// Calcul de la marge d'une mission pour un mois (spec section 3).
// Les TJM sont en € HT. Tous les montants renvoyés sont arrondis au centime.

const arrondiCentime = (n: number) => Math.round(n * 100) / 100;

// Marge dégagée par jour facturé.
export function margeParJour(tjmAchat: number, tjmVente: number): number {
  return arrondiCentime(tjmVente - tjmAchat);
}

export type ResultatMarge = {
  ca: number; // chiffre d'affaires prévisionnel
  cout: number; // coût prévisionnel
  marge: number; // marge prévisionnelle
  tauxMarge: number; // ratio entre 0 et 1 (ex : 0,25 = 25 %). 0 si le CA est nul.
};

type LigneMissionRealisee = {
  tjmAchat: string | number;
  tjmVente: string | number;
};

export type ResultatMissionRealisee = {
  ca: number;
  marge: number;
  joursFactures: number;
};

export function calculMarge(
  joursFacturables: number,
  tjmAchat: number,
  tjmVente: number
): ResultatMarge {
  const ca = arrondiCentime(joursFacturables * tjmVente);
  const cout = arrondiCentime(joursFacturables * tjmAchat);
  const marge = arrondiCentime(ca - cout);
  // Le taux de marge n'a pas de sens si le CA est nul : on renvoie 0 pour éviter une division par zéro.
  const tauxMarge = ca > 0 ? marge / ca : 0;
  return { ca, cout, marge, tauxMarge };
}

export function calculMissionRealisee(
  lignes: LigneMissionRealisee[]
): ResultatMissionRealisee {
  const totaux = lignes.reduce(
    (acc, ligne) => {
      const tjmVente = Number(ligne.tjmVente);
      const tjmAchat = Number(ligne.tjmAchat);
      acc.ca += tjmVente;
      acc.marge += tjmVente - tjmAchat;
      return acc;
    },
    { ca: 0, marge: 0 }
  );

  return {
    ca: arrondiCentime(totaux.ca),
    marge: arrondiCentime(totaux.marge),
    joursFactures: lignes.length,
  };
}
