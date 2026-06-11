// Seeder de SIMULATION : remplit la base avec un jeu de données de démonstration.
// Usage : npm run seed:simulation
//
// Contenu :
//   - 3 clients   : Wenimmo, APG, Delta
//   - 3 freelances: Maxime, Alex, Paul
//   - 6 missions  : chaque freelance travaille pour 2 clients, chaque client a 2 freelances
//   - un planning jour par jour (affectations) sur mai -> juillet 2026, jours ouvrés
//   - 2 projets forfait avec échéancier (recettes/coûts, réalisé + prévu) et fiabilités
//
// ATTENTION : ce script REMET À ZÉRO les données métier (clients, freelances,
// missions, affectations, projets...). Il ne touche PAS aux comptes utilisateurs.
// À n'utiliser qu'en développement.

import "dotenv/config";
import { createSqlClient } from "./db-url.mjs";

const sql = createSqlClient();

// --- Jours fériés français à exclure (sous-ensemble couvrant mai-juillet 2026) ---
const feries2026 = new Set([
  "2026-05-01", // Fête du travail
  "2026-05-08", // Victoire 1945
  "2026-05-14", // Ascension
  "2026-05-25", // Lundi de Pentecôte
  "2026-07-14", // Fête nationale
]);

// Liste des jours ouvrés (lun-ven, hors fériés) sur un intervalle inclusif.
function joursOuvres(debutISO, finISO) {
  const dates = [];
  let courant = new Date(debutISO + "T00:00:00Z");
  const fin = new Date(finISO + "T00:00:00Z");
  while (courant.getTime() <= fin.getTime()) {
    const jour = courant.getUTCDay(); // 0 = dimanche, 6 = samedi
    const texte = courant.toISOString().slice(0, 10);
    if (jour !== 0 && jour !== 6 && !feries2026.has(texte)) dates.push(texte);
    courant = new Date(courant.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

try {
  // 1) Remise à zéro des données métier (les utilisateurs sont préservés).
  await sql`TRUNCATE jalons, encaissements, decaissements, projets, affectations, missions, freelances, clients RESTART IDENTITY CASCADE`;

  // 2) Clients, avec leur fiabilité de paiement par défaut (cf. prévisionnel) :
  //    Wenimmo = bon payeur, APG = moyen, Delta = historiquement incertain.
  const clients = await sql`
    INSERT INTO clients (nom, fiabilite_defaut) VALUES
      ('Wenimmo', 'securise'),
      ('APG', 'probable'),
      ('Delta', 'incertain')
    RETURNING id, nom`;
  const idClient = Object.fromEntries(clients.map((c) => [c.nom, c.id]));

  // 3) Freelances (prénom + nom, le nom est obligatoire dans le schéma)
  const freelances = await sql`
    INSERT INTO freelances (prenom, nom) VALUES
      ('Maxime', 'Dubois'),
      ('Alex', 'Martin'),
      ('Paul', 'Bernard')
    RETURNING id, prenom`;
  const idFree = Object.fromEntries(freelances.map((f) => [f.prenom, f.id]));

  // 4) Missions : on relie freelances et clients.
  //    Chaque freelance a une mission "principale" et une "secondaire" chez un autre client.
  const defsMissions = [
    { free: "Maxime", client: "Wenimmo", nom: "Refonte site Wenimmo", achat: 450, vente: 700 },
    { free: "Maxime", client: "APG", nom: "Support technique APG", achat: 450, vente: 680 },
    { free: "Alex", client: "APG", nom: "App mobile APG", achat: 500, vente: 750 },
    { free: "Alex", client: "Delta", nom: "Intégration Delta", achat: 500, vente: 720 },
    { free: "Paul", client: "Delta", nom: "Plateforme data Delta", achat: 550, vente: 850 },
    { free: "Paul", client: "Wenimmo", nom: "Audit performance Wenimmo", achat: 550, vente: 800 },
  ];

  const missionsCrees = [];
  for (const m of defsMissions) {
    const [row] = await sql`
      INSERT INTO missions (freelance_id, client_id, nom, tjm_achat, tjm_vente)
      VALUES (${idFree[m.free]}, ${idClient[m.client]}, ${m.nom}, ${m.achat}, ${m.vente})
      RETURNING id`;
    missionsCrees.push({ ...m, id: row.id });
  }

  // Pour chaque freelance : [mission principale, mission secondaire]
  const missionsParFree = {};
  for (const m of missionsCrees) {
    (missionsParFree[m.free] ??= []).push(m);
  }

  // 5) Planning jour par jour sur mai -> juillet 2026.
  //    Règles (déterministes) pour un rendu réaliste :
  //      - 1 jour sur 10 : freelance non affecté (congé / inter-contrat)
  //      - 1 semaine sur 4 : il bascule sur sa mission secondaire
  //      - le reste du temps : mission principale
  //    Le TJM est figé (recopié de la mission) au moment où le jour est posé.
  const jours = joursOuvres("2026-05-01", "2026-07-31");
  const lignes = [];
  for (const free of Object.keys(missionsParFree)) {
    const [principale, secondaire] = missionsParFree[free];
    jours.forEach((date, i) => {
      if (i % 10 === 5) return; // jour off
      const semaine = Math.floor(i / 5);
      const mission = semaine % 4 === 3 ? secondaire : principale;
      lignes.push({
        missionId: mission.id,
        freelanceId: idFree[free],
        date,
        tjmAchat: mission.achat,
        tjmVente: mission.vente,
      });
    });
  }

  for (const l of lignes) {
    await sql`
      INSERT INTO affectations (mission_id, freelance_id, date, tjm_achat, tjm_vente)
      VALUES (${l.missionId}, ${l.freelanceId}, ${l.date}, ${l.tjmAchat}, ${l.tjmVente})`;
  }

  // 6) Projets au FORFAIT, avec leur échéancier (recettes + coûts).
  //    statut 'encaisse'/'decaisse' = réalisé (passé), 'prevu' = attendu (futur).
  //    fiabilite sur une recette prévue = surcharge la cascade projet/client.
  //    (Aujourd'hui de la simulation : 2026-06-10. Avant = réalisé, après = prévu.)
  const projetsDef = [
    {
      client: "APG",
      nom: "Site e-commerce APG (forfait)",
      budget: 60000,
      fiabiliteDefaut: null, // hérite d'APG (probable)
      recettes: [
        { date: "2026-05-15", montant: 20000, libelle: "Acompte 30%", statut: "encaisse", fiabilite: null },
        { date: "2026-06-30", montant: 25000, libelle: "Jalon 2 - livraison V1", statut: "prevu", fiabilite: null },
        { date: "2026-07-31", montant: 15000, libelle: "Solde", statut: "prevu", fiabilite: "incertain" },
      ],
      couts: [
        { free: "Alex", date: "2026-05-20", montant: 8000, libelle: "Sprint 1", statut: "decaisse" },
        { free: "Paul", date: "2026-06-10", montant: 6000, libelle: "Architecture", statut: "decaisse" },
        { free: "Alex", date: "2026-06-25", montant: 9000, libelle: "Sprint 2", statut: "prevu" },
        { free: "Maxime", date: "2026-07-15", montant: 5000, libelle: "Finitions", statut: "prevu" },
      ],
      jalons: [
        { date: "2026-05-05", libelle: "Kickoff projet" },
        { date: "2026-06-15", libelle: "Livraison V1" },
        { date: "2026-07-20", libelle: "Recette client" },
      ],
    },
    {
      client: "Delta",
      nom: "Refonte CRM Delta (forfait)",
      budget: 40000,
      fiabiliteDefaut: "probable", // surcharge : ce projet Delta est mieux sécurisé que d'habitude
      recettes: [
        { date: "2026-06-01", montant: 10000, libelle: "Acompte", statut: "encaisse", fiabilite: null },
        { date: "2026-07-15", montant: 18000, libelle: "Jalon livraison", statut: "prevu", fiabilite: null },
        { date: "2026-09-30", montant: 12000, libelle: "Solde", statut: "prevu", fiabilite: "arisque" },
      ],
      couts: [
        { free: "Paul", date: "2026-06-05", montant: 7000, libelle: "Cadrage", statut: "decaisse" },
        { free: "Alex", date: "2026-07-20", montant: 8000, libelle: "Développement", statut: "prevu" },
      ],
      jalons: [
        { date: "2026-06-02", libelle: "Kickoff" },
        { date: "2026-09-15", libelle: "Go-live" },
      ],
    },
  ];

  for (const p of projetsDef) {
    const [projet] = await sql`
      INSERT INTO projets (client_id, nom, budget, fiabilite_defaut)
      VALUES (${idClient[p.client]}, ${p.nom}, ${p.budget}, ${p.fiabiliteDefaut})
      RETURNING id`;
    for (const r of p.recettes) {
      await sql`
        INSERT INTO encaissements (projet_id, date, montant, libelle, statut, fiabilite)
        VALUES (${projet.id}, ${r.date}, ${r.montant}, ${r.libelle}, ${r.statut}, ${r.fiabilite})`;
    }
    for (const c of p.couts) {
      await sql`
        INSERT INTO decaissements (projet_id, freelance_id, date, montant, libelle, statut)
        VALUES (${projet.id}, ${idFree[c.free]}, ${c.date}, ${c.montant}, ${c.libelle}, ${c.statut})`;
    }
    for (const j of p.jalons) {
      await sql`
        INSERT INTO jalons (projet_id, date, libelle)
        VALUES (${projet.id}, ${j.date}, ${j.libelle})`;
    }
  }

  // Petit récap chiffré.
  const nbRecettes = projetsDef.reduce((s, p) => s + p.recettes.length, 0);
  const nbCouts = projetsDef.reduce((s, p) => s + p.couts.length, 0);
  const nbJalons = projetsDef.reduce((s, p) => s + p.jalons.length, 0);
  const recPrevues = projetsDef.flatMap((p) => p.recettes).filter((r) => r.statut === "prevu").length;
  const coutsPrevus = projetsDef.flatMap((p) => p.couts).filter((c) => c.statut === "prevu").length;

  console.log("Simulation chargée :");
  console.log(`  Clients      : ${clients.length}`);
  console.log(`  Freelances   : ${freelances.length}`);
  console.log(`  Missions     : ${missionsCrees.length}`);
  console.log(`  Affectations : ${lignes.length} (jours posés sur mai -> juillet 2026)`);
  console.log(`  Projets forfait : ${projetsDef.length}`);
  console.log(`    Recettes : ${nbRecettes} (dont ${recPrevues} prévues)`);
  console.log(`    Coûts    : ${nbCouts} (dont ${coutsPrevus} prévus)`);
  console.log(`    Jalons   : ${nbJalons}`);
} finally {
  await sql.end();
}
