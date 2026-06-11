type Montant = string | number;

export type LigneRegieClient = {
  clientId: number;
  date: string;
  tjmVente: Montant;
  tjmAchat: Montant;
};

export type FluxForfaitClient = {
  clientId: number;
  date: string;
  montant: Montant;
};

export type StatsClient = {
  caTotal: number;
  caMois: number;
  margeTotale: number;
};

type StatsClientInternes = StatsClient & {
  coutTotal: number;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

function estDansLeMois(date: string, debutMois: string, finMois: string): boolean {
  return date >= debutMois && date <= finMois;
}

function statsPour(map: Map<number, StatsClientInternes>, clientId: number): StatsClientInternes {
  const stats = map.get(clientId) ?? { caTotal: 0, caMois: 0, coutTotal: 0, margeTotale: 0 };
  map.set(clientId, stats);
  return stats;
}

export function calculerStatsClients({
  regie,
  encaissements,
  decaissements,
  debutMois,
  finMois,
}: {
  regie: LigneRegieClient[];
  encaissements: FluxForfaitClient[];
  decaissements: FluxForfaitClient[];
  debutMois: string;
  finMois: string;
}): Map<number, StatsClient> {
  const statsParClient = new Map<number, StatsClientInternes>();

  for (const ligne of regie) {
    const stats = statsPour(statsParClient, ligne.clientId);
    const ca = Number(ligne.tjmVente);
    stats.caTotal += ca;
    stats.coutTotal += Number(ligne.tjmAchat);
    if (estDansLeMois(ligne.date, debutMois, finMois)) stats.caMois += ca;
  }

  for (const encaissement of encaissements) {
    const stats = statsPour(statsParClient, encaissement.clientId);
    const ca = Number(encaissement.montant);
    stats.caTotal += ca;
    if (estDansLeMois(encaissement.date, debutMois, finMois)) stats.caMois += ca;
  }

  for (const decaissement of decaissements) {
    const stats = statsPour(statsParClient, decaissement.clientId);
    stats.coutTotal += Number(decaissement.montant);
  }

  return new Map(
    Array.from(statsParClient, ([clientId, stats]) => [
      clientId,
      {
        caTotal: arrondi(stats.caTotal),
        caMois: arrondi(stats.caMois),
        margeTotale: arrondi(stats.caTotal - stats.coutTotal),
      },
    ])
  );
}
