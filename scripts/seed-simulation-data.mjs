const MS_JOUR = 24 * 60 * 60 * 1000;

export function isoJour(date) {
  return date.toISOString().slice(0, 10);
}

function dateUTC(annee, moisIndex, jour) {
  return new Date(Date.UTC(annee, moisIndex, jour));
}

function joursDansMois(annee, moisIndex) {
  return new Date(Date.UTC(annee, moisIndex + 1, 0)).getUTCDate();
}

function ajouterMois(date, delta) {
  return dateUTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1);
}

function dateDansMois(reference, deltaMois, jourVoulu) {
  const mois = ajouterMois(reference, deltaMois);
  const dernierJour = joursDansMois(mois.getUTCFullYear(), mois.getUTCMonth());
  return isoJour(dateUTC(mois.getUTCFullYear(), mois.getUTCMonth(), Math.min(jourVoulu, dernierJour)));
}

function premierJourMois(reference, deltaMois = 0) {
  return isoJour(ajouterMois(reference, deltaMois));
}

function dernierJourMois(reference, deltaMois = 0) {
  const mois = ajouterMois(reference, deltaMois);
  return isoJour(dateUTC(mois.getUTCFullYear(), mois.getUTCMonth(), joursDansMois(mois.getUTCFullYear(), mois.getUTCMonth())));
}

// Liste des jours ouvrés (lun-ven) sur un intervalle inclusif.
export function joursOuvres(debutISO, finISO) {
  const dates = [];
  let courant = new Date(`${debutISO}T00:00:00Z`);
  const fin = new Date(`${finISO}T00:00:00Z`);

  while (courant.getTime() <= fin.getTime()) {
    const jour = courant.getUTCDay();
    if (jour !== 0 && jour !== 6) dates.push(isoJour(courant));
    courant = new Date(courant.getTime() + MS_JOUR);
  }

  return dates;
}

export function construireSimulation(maintenant = new Date()) {
  const reference = dateUTC(
    maintenant.getUTCFullYear(),
    maintenant.getUTCMonth(),
    maintenant.getUTCDate()
  );
  const jourCourant = reference.getUTCDate();
  const realiseCourant = Math.max(1, jourCourant - 4);
  const prevuCourant = Math.min(
    joursDansMois(reference.getUTCFullYear(), reference.getUTCMonth()),
    jourCourant + 8
  );

  const clients = [
    { nom: "Wenimmo", fiabiliteDefaut: "securise", actif: true },
    { nom: "APG", fiabiliteDefaut: "probable", actif: true },
    { nom: "Delta", fiabiliteDefaut: "incertain", actif: true },
    { nom: "Nova Santé", fiabiliteDefaut: "securise", actif: true },
    { nom: "Legacy Corp", fiabiliteDefaut: "arisque", actif: false },
  ];

  const freelances = [
    { prenom: "Maxime", nom: "Dubois", actif: true },
    { prenom: "Alex", nom: "Martin", actif: true },
    { prenom: "Paul", nom: "Bernard", actif: true },
    { prenom: "Sarah", nom: "Nguyen", actif: true },
    { prenom: "Nina", nom: "Leroy", actif: false },
  ];

  const missions = [
    { free: "Maxime", client: "Wenimmo", nom: "Refonte site Wenimmo", achat: 450, vente: 700, actif: true },
    { free: "Maxime", client: "APG", nom: "Support technique APG", achat: 450, vente: 680, actif: true },
    { free: "Alex", client: "APG", nom: "App mobile APG", achat: 500, vente: 750, actif: true },
    { free: "Alex", client: "Delta", nom: "Intégration Delta", achat: 500, vente: 720, actif: true },
    { free: "Paul", client: "Delta", nom: "Plateforme data Delta", achat: 550, vente: 850, actif: true },
    { free: "Paul", client: "Wenimmo", nom: "Audit performance Wenimmo", achat: 550, vente: 800, actif: true },
    { free: "Sarah", client: "Nova Santé", nom: "Portail patient Nova", achat: 520, vente: 820, actif: true },
    { free: "Sarah", client: "APG", nom: "Reporting BI APG", achat: 520, vente: 790, actif: true },
    { free: "Nina", client: "Legacy Corp", nom: "Maintenance Legacy", achat: 430, vente: 650, actif: false },
  ];

  const projets = [
    {
      client: "APG",
      nom: "Site e-commerce APG (forfait)",
      budget: 76000,
      actif: true,
      fiabiliteDefaut: null,
      recettes: [
        { date: dateDansMois(reference, -1, 15), montant: 22000, libelle: "Acompte 30%", statut: "encaisse", fiabilite: null },
        { date: dateDansMois(reference, 0, prevuCourant), montant: 24000, libelle: "Jalon V1", statut: "prevu", fiabilite: "80" },
        { date: dateDansMois(reference, 1, 28), montant: 30000, libelle: "Solde", statut: "prevu", fiabilite: "60" },
      ],
      couts: [
        { free: "Alex", date: dateDansMois(reference, -1, 20), montant: 9000, libelle: "Sprint 1", statut: "decaisse" },
        { free: "Paul", date: dateDansMois(reference, 0, realiseCourant + 1), montant: 6000, libelle: "Architecture", statut: "decaisse" },
        { free: "Alex", date: dateDansMois(reference, 0, prevuCourant), montant: 10000, libelle: "Sprint 2", statut: "prevu" },
        { free: "Maxime", date: dateDansMois(reference, 1, 15), montant: 7000, libelle: "Finitions", statut: "prevu" },
      ],
      jalons: [
        { date: dateDansMois(reference, -1, 5), libelle: "Kickoff projet" },
        { date: dateDansMois(reference, 0, prevuCourant), libelle: "Livraison V1" },
        { date: dateDansMois(reference, 1, 20), libelle: "Recette client" },
      ],
    },
    {
      client: "Delta",
      nom: "Refonte CRM Delta (forfait)",
      budget: 48000,
      actif: true,
      fiabiliteDefaut: "probable",
      recettes: [
        { date: dateDansMois(reference, 0, realiseCourant), montant: 10000, libelle: "Acompte", statut: "encaisse", fiabilite: null },
        { date: dateDansMois(reference, 1, 15), montant: 18000, libelle: "Jalon livraison", statut: "prevu", fiabilite: null },
        { date: dateDansMois(reference, 3, 30), montant: 20000, libelle: "Solde", statut: "prevu", fiabilite: "35" },
      ],
      couts: [
        { free: "Paul", date: dateDansMois(reference, 0, realiseCourant + 1), montant: 7000, libelle: "Cadrage", statut: "decaisse" },
        { free: "Alex", date: dateDansMois(reference, 1, 20), montant: 12000, libelle: "Développement", statut: "prevu" },
      ],
      jalons: [
        { date: dateDansMois(reference, 0, realiseCourant + 2), libelle: "Kickoff" },
        { date: dateDansMois(reference, 3, 15), libelle: "Go-live" },
      ],
    },
    {
      client: "Nova Santé",
      nom: "Data warehouse Nova (forfait)",
      budget: 90000,
      actif: true,
      fiabiliteDefaut: "securise",
      recettes: [
        { date: dateDansMois(reference, -2, 25), montant: 30000, libelle: "Acompte cadrage", statut: "encaisse", fiabilite: null },
        { date: dateDansMois(reference, 0, prevuCourant), montant: 30000, libelle: "Lot ingestion", statut: "prevu", fiabilite: "90" },
        { date: dateDansMois(reference, 2, 25), montant: 30000, libelle: "Lot restitution", statut: "prevu", fiabilite: "70" },
      ],
      couts: [
        { free: "Sarah", date: dateDansMois(reference, -1, 25), montant: 12000, libelle: "Cadrage data", statut: "decaisse" },
        { free: "Sarah", date: dateDansMois(reference, 1, 10), montant: 18000, libelle: "Pipeline", statut: "prevu" },
        { free: "Paul", date: dateDansMois(reference, 2, 12), montant: 15000, libelle: "Optimisation", statut: "prevu" },
      ],
      jalons: [
        { date: dateDansMois(reference, 0, prevuCourant), libelle: "Validation modèle" },
        { date: dateDansMois(reference, 2, 15), libelle: "Recette BI" },
      ],
    },
    {
      client: "Wenimmo",
      nom: "Audit express Wenimmo (forfait réalisé)",
      budget: 15000,
      actif: false,
      fiabiliteDefaut: null,
      recettes: [
        { date: dateDansMois(reference, -1, 8), montant: 15000, libelle: "Audit complet", statut: "encaisse", fiabilite: null },
      ],
      couts: [
        { free: "Maxime", date: dateDansMois(reference, -1, 9), montant: 5000, libelle: "Analyse", statut: "decaisse" },
      ],
      jalons: [
        { date: dateDansMois(reference, -1, 10), libelle: "Rapport final" },
      ],
    },
  ];

  return {
    reference: isoJour(reference),
    planning: {
      debut: premierJourMois(reference, 0),
      fin: dernierJourMois(reference, 4),
    },
    clients,
    freelances,
    missions,
    projets,
  };
}
