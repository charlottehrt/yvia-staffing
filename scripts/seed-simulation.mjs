// Seeder de SIMULATION : prépare un environnement complet de démonstration.
// Usage : npm run seed:simulation
//
// Contenu :
//   - 1 admin de test : admin@yvia.io / admin (surchargeable par env)
//   - comptes utilisateurs, invitations en attente/expirées/utilisées
//   - clients et freelances actifs + archivés
//   - missions actives + inactive
//   - planning régie du mois courant jusqu'à plusieurs mois futurs
//   - projets forfaitaires réalisés, en cours et à venir
//   - encaissements/décaissements réalisés et prévus pour tester Pilotage
//
// ATTENTION : ce script REMET À ZÉRO les données métier (clients, freelances,
// missions, affectations, projets...). Il préserve les autres comptes mais
// crée/réinitialise le compte admin de démonstration.
// À n'utiliser qu'en développement.

import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { createSqlClient } from "./db-url.mjs";
import { construireSimulation, joursOuvres } from "./seed-simulation-data.mjs";

const sql = createSqlClient();

const emailAdmin = (process.env.SEED_ADMIN_EMAIL ?? "admin@yvia.io").toLowerCase();
const motDePasseAdmin = process.env.SEED_ADMIN_PASSWORD ?? "admin";
const nomAdmin = process.env.SEED_ADMIN_NOM ?? "Admin";

// Même format que src/lib/auth/password.ts : "scrypt$<sel hex>$<hash hex>".
function hasher(mdp) {
  const sel = randomBytes(16);
  const hash = scryptSync(mdp, sel, 64);
  return `scrypt$${sel.toString("hex")}$${hash.toString("hex")}`;
}

function grouperPar(items, cle) {
  const groupes = {};
  for (const item of items) (groupes[item[cle]] ??= []).push(item);
  return groupes;
}

try {
  const simulation = construireSimulation(new Date());

  // 1) Comptes de démonstration.
  await sql`
    INSERT INTO users (email, password_hash, prenom, nom, actif, role)
    VALUES (${emailAdmin}, ${hasher(motDePasseAdmin)}, ${null}, ${nomAdmin}, ${true}, ${"admin"})
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          prenom = EXCLUDED.prenom,
          nom = EXCLUDED.nom,
          actif = true,
          role = 'admin'`;

  for (const u of simulation.utilisateurs) {
    await sql`
      INSERT INTO users (email, password_hash, prenom, nom, actif, role)
      VALUES (${u.email}, ${hasher(u.motDePasse)}, ${u.prenom}, ${u.nom}, ${u.actif}, ${u.role})
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            prenom = EXCLUDED.prenom,
            nom = EXCLUDED.nom,
            actif = EXCLUDED.actif,
            role = EXCLUDED.role`;
  }

  // 2) Remise à zéro des données de preview.
  await sql`TRUNCATE invitations, jalons, encaissements, decaissements, projets, affectations, missions, freelances, clients RESTART IDENTITY CASCADE`;

  for (const invitation of simulation.invitations) {
    await sql`
      INSERT INTO invitations (token, email, prenom, nom, expire_le, utilisee, role)
      VALUES (
        ${invitation.token},
        ${invitation.email},
        ${invitation.prenom},
        ${invitation.nom},
        ${invitation.expireLe},
        ${invitation.utilisee},
        ${invitation.role}
      )`;
  }

  // 3) Clients.
  const clients = [];
  for (const c of simulation.clients) {
    const [row] = await sql`
      INSERT INTO clients (nom, actif, fiabilite_defaut)
      VALUES (${c.nom}, ${c.actif}, ${c.fiabiliteDefaut})
      RETURNING id, nom`;
    clients.push(row);
  }
  const idClient = Object.fromEntries(clients.map((c) => [c.nom, c.id]));

  // 4) Freelances.
  const freelances = [];
  for (const f of simulation.freelances) {
    const [row] = await sql`
      INSERT INTO freelances (prenom, nom, actif, afficher_planning)
      VALUES (${f.prenom}, ${f.nom}, ${f.actif}, ${f.afficherPlanning})
      RETURNING id, prenom`;
    freelances.push(row);
  }
  const idFree = Object.fromEntries(freelances.map((f) => [f.prenom, f.id]));

  // 5) Missions.
  const missionsCrees = [];
  for (const m of simulation.missions) {
    const [row] = await sql`
      INSERT INTO missions (freelance_id, client_id, nom, tjm_achat, tjm_vente, actif)
      VALUES (${idFree[m.free]}, ${idClient[m.client]}, ${m.nom}, ${m.achat}, ${m.vente}, ${m.actif})
      RETURNING id`;
    missionsCrees.push({ ...m, id: row.id });
  }

  // 6) Planning régie : uniquement les freelances et missions actifs.
  const missionsActivesParFree = grouperPar(
    missionsCrees.filter((m) => m.actif),
    "free"
  );
  const freelancesActifs = simulation.freelances.filter((f) => f.actif);
  const jours = joursOuvres(simulation.planning.debut, simulation.planning.fin);
  const lignesAffectations = [];

  for (const free of freelancesActifs) {
    const missionsFree = missionsActivesParFree[free.prenom] ?? [];
    if (missionsFree.length === 0) continue;

    jours.forEach((date, i) => {
      if (i % 11 === 6) return; // respiration : inter-contrat / congé
      const semaine = Math.floor(i / 5);
      const mission = missionsFree[semaine % missionsFree.length];
      lignesAffectations.push({
        missionId: mission.id,
        freelanceId: idFree[free.prenom],
        date,
        tjmAchat: mission.achat,
        tjmVente: mission.vente,
      });
    });
  }

  for (const l of lignesAffectations) {
    await sql`
      INSERT INTO affectations (mission_id, freelance_id, date, tjm_achat, tjm_vente)
      VALUES (${l.missionId}, ${l.freelanceId}, ${l.date}, ${l.tjmAchat}, ${l.tjmVente})`;
  }

  // 7) Projets forfaitaires, recettes, coûts et jalons.
  for (const p of simulation.projets) {
    const [projet] = await sql`
      INSERT INTO projets (client_id, nom, budget, actif, fiabilite_defaut, statut_commercial)
      VALUES (
        ${idClient[p.client]},
        ${p.nom},
        ${p.budget},
        ${p.actif},
        ${p.fiabiliteDefaut},
        ${p.statutCommercial}
      )
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

  const recettes = simulation.projets.flatMap((p) => p.recettes);
  const couts = simulation.projets.flatMap((p) => p.couts);
  const jalons = simulation.projets.flatMap((p) => p.jalons);
  const recRealisees = recettes.filter((r) => r.statut === "encaisse").length;
  const recPrevues = recettes.filter((r) => r.statut === "prevu").length;
  const coutsRealises = couts.filter((c) => c.statut === "decaisse").length;
  const coutsPrevus = couts.filter((c) => c.statut === "prevu").length;

  console.log("Simulation complète chargée :");
  console.log(`  Admin        : ${emailAdmin} / ${motDePasseAdmin}`);
  console.log(`  Utilisateurs : ${simulation.utilisateurs.length + 1}`);
  console.log(`  Invitations  : ${simulation.invitations.length}`);
  console.log(`  Référence    : ${simulation.reference}`);
  console.log(`  Clients      : ${clients.length} (${simulation.clients.filter((c) => !c.actif).length} archivé)`);
  console.log(`  Freelances   : ${freelances.length} (${simulation.freelances.filter((f) => !f.actif).length} inactif)`);
  console.log(`  Missions     : ${missionsCrees.length} (${simulation.missions.filter((m) => !m.actif).length} inactive)`);
  console.log(`  Affectations : ${lignesAffectations.length} (${simulation.planning.debut} -> ${simulation.planning.fin})`);
  console.log(`  Projets      : ${simulation.projets.length}`);
  console.log(`    Recettes   : ${recettes.length} (${recRealisees} encaissées, ${recPrevues} prévues)`);
  console.log(`    Coûts      : ${couts.length} (${coutsRealises} décaissés, ${coutsPrevus} prévus)`);
  console.log(`    Jalons     : ${jalons.length}`);
  console.log("Connecte-toi sur /login puis ouvre /statistiques.");
} finally {
  await sql.end();
}
