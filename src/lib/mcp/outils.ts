// Outils MCP en lecture seule exposant les données métier (freelances, clients,
// missions/prestas, projets, planning, trésorerie). Chaque outil interroge la
// base via Drizzle et renvoie du JSON. La logique de calcul (marge, pilotage,
// trésorerie) réutilise les libs partagées avec l'application pour rester
// cohérente avec ce qu'affiche le dashboard.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq, gte, ilike, inArray, lte, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  freelances,
  clients,
  missions,
  affectations,
  projets,
  jalons,
  encaissements,
  decaissements,
} from "@/db/schema";
import { margeParJour } from "@/lib/calculs/marge";
import { premierJourDuMois, dernierJourDuMois } from "@/lib/calculs/jours-ouvres";
import {
  calculerPilotageMensuel,
  type AffectationPilotage,
  type EncaissementPilotage,
  type DecaissementPilotage,
} from "@/app/statistiques/pilotage-calculs";
import { fusionnerEvenements } from "@/lib/projets/evenements";
import { labelStatutCommercial, STATUTS_COMMERCIAUX } from "@/lib/projets/statut-commercial";

// --- Utilitaires de mise en forme ---------------------------------------------

const eur = (n: number) => Math.round(n * 100) / 100;
const num = (v: string | number) => Number(v);
const nomComplet = (prenom: string, nom: string) => `${prenom} ${nom}`.trim();

type ResultatOutil = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const json = (data: unknown): ResultatOutil => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

const erreur = (message: string): ResultatOutil => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

// Combine des conditions optionnelles en un seul WHERE (undefined = pas de filtre).
function combiner(conditions: (SQL | undefined)[]): SQL | undefined {
  const presentes = conditions.filter((c): c is SQL => c !== undefined);
  if (presentes.length === 0) return undefined;
  if (presentes.length === 1) return presentes[0];
  return and(...presentes);
}

// "AAAA-MM" -> { annee, mois } validé, ou null si invalide.
function parseMois(valeur: string): { annee: number; mois: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(valeur);
  if (!m) return null;
  const annee = Number(m[1]);
  const mois = Number(m[2]);
  if (mois < 1 || mois > 12) return null;
  return { annee, mois };
}

function ajouterMois(annee: number, mois: number, n: number): { annee: number; mois: number } {
  const total = (annee * 12 + (mois - 1)) + n;
  return { annee: Math.floor(total / 12), mois: (total % 12) + 1 };
}

// Résumé de trésorerie d'un ensemble d'échéances rattachées à un même projet.
function resumeTresorerie(
  encs: { montant: string; statut: string }[],
  decs: { montant: string; statut: string }[]
) {
  const totalEncaisse = encs.filter((e) => e.statut === "encaisse").reduce((s, e) => s + num(e.montant), 0);
  const recettesPrevues = encs.filter((e) => e.statut === "prevu").reduce((s, e) => s + num(e.montant), 0);
  const totalDecaisse = decs.filter((d) => d.statut === "decaisse").reduce((s, d) => s + num(d.montant), 0);
  const coutsPrevus = decs.filter((d) => d.statut === "prevu").reduce((s, d) => s + num(d.montant), 0);
  return {
    totalEncaisse: eur(totalEncaisse),
    recettesPrevues: eur(recettesPrevues),
    totalDecaisse: eur(totalDecaisse),
    coutsPrevus: eur(coutsPrevus),
    margeRealisee: eur(totalEncaisse - totalDecaisse),
  };
}

// --- Enregistrement des outils ------------------------------------------------

export function enregistrerOutils(server: McpServer): void {
  // 1. Freelances ------------------------------------------------------------
  server.registerTool(
    "lister_freelances",
    {
      title: "Lister les freelances",
      description:
        "Liste les freelances (consultants placés en mission chez des clients). Par défaut, seuls les freelances actifs sont renvoyés.",
      inputSchema: {
        inclure_inactifs: z
          .boolean()
          .optional()
          .describe("Inclure aussi les freelances inactifs/archivés (défaut : false)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ inclure_inactifs }) => {
      const lignes = await db
        .select({
          id: freelances.id,
          prenom: freelances.prenom,
          nom: freelances.nom,
          actif: freelances.actif,
        })
        .from(freelances)
        .where(inclure_inactifs ? undefined : eq(freelances.actif, true))
        .orderBy(freelances.nom, freelances.prenom);
      return json({ total: lignes.length, freelances: lignes });
    }
  );

  // 2. Clients ---------------------------------------------------------------
  server.registerTool(
    "lister_clients",
    {
      title: "Lister les clients",
      description:
        "Liste les clients (sociétés chez qui les freelances sont placés ou pour qui des projets au forfait sont vendus). Par défaut, seuls les clients actifs.",
      inputSchema: {
        inclure_inactifs: z
          .boolean()
          .optional()
          .describe("Inclure aussi les clients archivés (défaut : false)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ inclure_inactifs }) => {
      const lignes = await db
        .select({
          id: clients.id,
          nom: clients.nom,
          actif: clients.actif,
          fiabilitePaiement: clients.fiabiliteDefaut,
        })
        .from(clients)
        .where(inclure_inactifs ? undefined : eq(clients.actif, true))
        .orderBy(clients.nom);
      return json({ total: lignes.length, clients: lignes });
    }
  );

  // 3. Missions / prestas ----------------------------------------------------
  server.registerTool(
    "lister_missions",
    {
      title: "Lister les missions (prestas)",
      description:
        "Liste les missions, aussi appelées « prestas » ou prestations : un freelance placé en régie chez un client, avec son TJM achat (ce qu'on paie au freelance) et son TJM vente (ce qu'on facture au client). Renvoie la marge par jour. Par défaut, seules les missions actives.",
      inputSchema: {
        inclure_inactives: z
          .boolean()
          .optional()
          .describe("Inclure aussi les missions inactives (défaut : false)."),
        freelance_id: z.number().int().positive().optional().describe("Filtrer sur un freelance."),
        client_id: z.number().int().positive().optional().describe("Filtrer sur un client."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ inclure_inactives, freelance_id, client_id }) => {
      const where = combiner([
        inclure_inactives ? undefined : eq(missions.actif, true),
        freelance_id ? eq(missions.freelanceId, freelance_id) : undefined,
        client_id ? eq(missions.clientId, client_id) : undefined,
      ]);
      const lignes = await db
        .select({
          id: missions.id,
          nom: missions.nom,
          freelanceId: missions.freelanceId,
          freelancePrenom: freelances.prenom,
          freelanceNom: freelances.nom,
          clientId: missions.clientId,
          clientNom: clients.nom,
          tjmAchat: missions.tjmAchat,
          tjmVente: missions.tjmVente,
          actif: missions.actif,
        })
        .from(missions)
        .innerJoin(freelances, eq(missions.freelanceId, freelances.id))
        .innerJoin(clients, eq(missions.clientId, clients.id))
        .where(where)
        .orderBy(missions.nom);

      const resultat = lignes.map((m) => ({
        id: m.id,
        nom: m.nom,
        freelanceId: m.freelanceId,
        freelance: nomComplet(m.freelancePrenom, m.freelanceNom),
        clientId: m.clientId,
        client: m.clientNom,
        tjmAchat: num(m.tjmAchat),
        tjmVente: num(m.tjmVente),
        margeParJour: margeParJour(num(m.tjmAchat), num(m.tjmVente)),
        actif: m.actif,
      }));
      return json({ total: resultat.length, missions: resultat });
    }
  );

  // 4. Projets (forfait) -----------------------------------------------------
  server.registerTool(
    "lister_projets",
    {
      title: "Lister les projets au forfait",
      description:
        "Liste les projets au forfait : une enveloppe budgétaire vendue à un client, suivie via des encaissements (recettes) et décaissements (coûts freelances). Renvoie le budget, le statut commercial et un résumé de trésorerie (encaissé, décaissé, prévu, reste à encaisser).",
      inputSchema: {
        inclure_inactifs: z
          .boolean()
          .optional()
          .describe("Inclure aussi les projets terminés (défaut : false)."),
        client_id: z.number().int().positive().optional().describe("Filtrer sur un client."),
        statut_commercial: z
          .enum(STATUTS_COMMERCIAUX.map((s) => s.key) as [string, ...string[]])
          .optional()
          .describe("Filtrer sur un statut commercial (a_qualifier, en_discussion, proposition_envoyee, gagne, perdu)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ inclure_inactifs, client_id, statut_commercial }) => {
      const where = combiner([
        inclure_inactifs ? undefined : eq(projets.actif, true),
        client_id ? eq(projets.clientId, client_id) : undefined,
        statut_commercial ? eq(projets.statutCommercial, statut_commercial) : undefined,
      ]);
      const liste = await db
        .select({
          id: projets.id,
          nom: projets.nom,
          clientId: projets.clientId,
          clientNom: clients.nom,
          budget: projets.budget,
          actif: projets.actif,
          statutCommercial: projets.statutCommercial,
        })
        .from(projets)
        .innerJoin(clients, eq(projets.clientId, clients.id))
        .where(where)
        .orderBy(projets.nom);

      if (liste.length === 0) return json({ total: 0, projets: [] });

      const ids = liste.map((p) => p.id);
      const [encs, decs] = await Promise.all([
        db
          .select({ projetId: encaissements.projetId, montant: encaissements.montant, statut: encaissements.statut })
          .from(encaissements)
          .where(inArray(encaissements.projetId, ids)),
        db
          .select({ projetId: decaissements.projetId, montant: decaissements.montant, statut: decaissements.statut })
          .from(decaissements)
          .where(inArray(decaissements.projetId, ids)),
      ]);

      const resultat = liste.map((p) => {
        const tresorerie = resumeTresorerie(
          encs.filter((e) => e.projetId === p.id),
          decs.filter((d) => d.projetId === p.id)
        );
        return {
          id: p.id,
          nom: p.nom,
          clientId: p.clientId,
          client: p.clientNom,
          budget: num(p.budget),
          actif: p.actif,
          statutCommercial: p.statutCommercial,
          statutCommercialLabel: labelStatutCommercial(p.statutCommercial),
          ...tresorerie,
          resteAEncaisser: eur(num(p.budget) - tresorerie.totalEncaisse),
        };
      });
      return json({ total: resultat.length, projets: resultat });
    }
  );

  // 5. Détail d'un projet (trésorerie + échéancier) --------------------------
  server.registerTool(
    "detail_projet",
    {
      title: "Détail d'un projet",
      description:
        "Détail complet d'un projet au forfait : budget, statut, résumé de trésorerie et échéancier chronologique fusionné (jalons, encaissements/recettes, décaissements/coûts, réalisés et prévus).",
      inputSchema: {
        projet_id: z.number().int().positive().describe("Identifiant du projet (cf. lister_projets)."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projet_id }) => {
      const [p] = await db
        .select({
          id: projets.id,
          nom: projets.nom,
          clientId: projets.clientId,
          clientNom: clients.nom,
          budget: projets.budget,
          actif: projets.actif,
          statutCommercial: projets.statutCommercial,
        })
        .from(projets)
        .innerJoin(clients, eq(projets.clientId, clients.id))
        .where(eq(projets.id, projet_id));

      if (!p) return erreur(`Projet ${projet_id} introuvable.`);

      const [recettes, couts, jalonsProjet] = await Promise.all([
        db
          .select({
            id: encaissements.id,
            date: encaissements.date,
            montant: encaissements.montant,
            libelle: encaissements.libelle,
            statut: encaissements.statut,
            fiabilite: encaissements.fiabilite,
          })
          .from(encaissements)
          .where(eq(encaissements.projetId, projet_id)),
        db
          .select({
            id: decaissements.id,
            date: decaissements.date,
            montant: decaissements.montant,
            libelle: decaissements.libelle,
            statut: decaissements.statut,
            freelancePrenom: freelances.prenom,
            freelanceNom: freelances.nom,
          })
          .from(decaissements)
          .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id))
          .where(eq(decaissements.projetId, projet_id)),
        db
          .select({ id: jalons.id, date: jalons.date, libelle: jalons.libelle })
          .from(jalons)
          .where(eq(jalons.projetId, projet_id)),
      ]);

      const evenements = fusionnerEvenements(
        recettes.map((r) => ({
          id: r.id,
          date: r.date,
          montant: r.montant,
          libelle: r.libelle,
          statut: r.statut,
          fiabilite: r.fiabilite,
        })),
        couts.map((c) => ({
          id: c.id,
          date: c.date,
          montant: c.montant,
          libelle: c.libelle,
          statut: c.statut,
          freelanceNom: nomComplet(c.freelancePrenom, c.freelanceNom),
        })),
        jalonsProjet.map((j) => ({ id: j.id, date: j.date, libelle: j.libelle }))
      );

      const tresorerie = resumeTresorerie(recettes, couts);
      return json({
        projet: {
          id: p.id,
          nom: p.nom,
          clientId: p.clientId,
          client: p.clientNom,
          budget: num(p.budget),
          actif: p.actif,
          statutCommercial: p.statutCommercial,
          statutCommercialLabel: labelStatutCommercial(p.statutCommercial),
        },
        tresorerie: { ...tresorerie, resteAEncaisser: eur(num(p.budget) - tresorerie.totalEncaisse) },
        evenements: evenements.map((e) => ({
          type: e.type,
          date: e.date,
          libelle: e.libelle,
          montant: e.montant !== null ? num(e.montant) : null,
          prevu: e.prevu,
          fiabilite: e.fiabilite,
        })),
      });
    }
  );

  // 6. Planning d'un mois (indicateurs + détail) -----------------------------
  server.registerTool(
    "planning_du_mois",
    {
      title: "Planning et marge d'un mois",
      description:
        "Pour un mois donné, renvoie les indicateurs affichés sur le dashboard (CA prévisionnel, coût total, marge totale, taux de marge) ainsi que le détail par mission (régie : jours posés, CA, coût, marge) et par projet au forfait (encaissements/décaissements réalisés du mois). Les week-ends et jours fériés ne sont pas distingués (un jour posé compte toujours).",
      inputSchema: {
        mois: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .describe("Mois au format AAAA-MM, par exemple 2026-06."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ mois }) => {
      const parsed = parseMois(mois);
      if (!parsed) return erreur(`Mois invalide : « ${mois} ». Format attendu : AAAA-MM.`);
      const debutMois = premierJourDuMois(parsed.annee, parsed.mois);
      const finMois = dernierJourDuMois(parsed.annee, parsed.mois);
      const fluxActif = and(eq(projets.actif, true), ne(projets.statutCommercial, "perdu"));

      const [affs, encMois, decMois, jalMois] = await Promise.all([
        db
          .select({
            missionId: affectations.missionId,
            missionNom: missions.nom,
            clientNom: clients.nom,
            freelancePrenom: freelances.prenom,
            freelanceNom: freelances.nom,
            tjmAchat: affectations.tjmAchat,
            tjmVente: affectations.tjmVente,
          })
          .from(affectations)
          .innerJoin(missions, eq(affectations.missionId, missions.id))
          .innerJoin(clients, eq(missions.clientId, clients.id))
          .innerJoin(freelances, eq(affectations.freelanceId, freelances.id))
          .where(and(gte(affectations.date, debutMois), lte(affectations.date, finMois))),
        db
          .select({ projetId: encaissements.projetId, projetNom: projets.nom, clientNom: clients.nom, montant: encaissements.montant })
          .from(encaissements)
          .innerJoin(projets, eq(encaissements.projetId, projets.id))
          .innerJoin(clients, eq(projets.clientId, clients.id))
          .where(and(eq(encaissements.statut, "encaisse"), fluxActif, gte(encaissements.date, debutMois), lte(encaissements.date, finMois))),
        db
          .select({ projetId: decaissements.projetId, projetNom: projets.nom, clientNom: clients.nom, montant: decaissements.montant })
          .from(decaissements)
          .innerJoin(projets, eq(decaissements.projetId, projets.id))
          .innerJoin(clients, eq(projets.clientId, clients.id))
          .where(and(eq(decaissements.statut, "decaisse"), fluxActif, gte(decaissements.date, debutMois), lte(decaissements.date, finMois))),
        db
          .select({ projetNom: projets.nom, date: jalons.date, libelle: jalons.libelle })
          .from(jalons)
          .innerJoin(projets, eq(jalons.projetId, projets.id))
          .where(and(fluxActif, gte(jalons.date, debutMois), lte(jalons.date, finMois)))
          .orderBy(jalons.date),
      ]);

      // Agrégation régie par mission (chaque jour porte son TJM figé).
      const parMission = new Map<
        number,
        { missionId: number; mission: string; client: string; freelance: string; jours: number; ca: number; cout: number }
      >();
      for (const a of affs) {
        const e =
          parMission.get(a.missionId) ?? {
            missionId: a.missionId,
            mission: a.missionNom,
            client: a.clientNom,
            freelance: nomComplet(a.freelancePrenom, a.freelanceNom),
            jours: 0,
            ca: 0,
            cout: 0,
          };
        e.jours += 1;
        e.ca += num(a.tjmVente);
        e.cout += num(a.tjmAchat);
        parMission.set(a.missionId, e);
      }
      const missionsDetail = Array.from(parMission.values()).map((e) => ({
        missionId: e.missionId,
        mission: e.mission,
        freelance: e.freelance,
        client: e.client,
        jours: e.jours,
        ca: eur(e.ca),
        cout: eur(e.cout),
        marge: eur(e.ca - e.cout),
      }));

      // Agrégation forfait par projet (flux réalisés du mois).
      const parProjet = new Map<number, { projet: string; client: string; encaissements: number; decaissements: number }>();
      for (const e of encMois) {
        const p = parProjet.get(e.projetId) ?? { projet: e.projetNom, client: e.clientNom, encaissements: 0, decaissements: 0 };
        p.encaissements += num(e.montant);
        parProjet.set(e.projetId, p);
      }
      for (const d of decMois) {
        const p = parProjet.get(d.projetId) ?? { projet: d.projetNom, client: d.clientNom, encaissements: 0, decaissements: 0 };
        p.decaissements += num(d.montant);
        parProjet.set(d.projetId, p);
      }
      const projetsDetail = Array.from(parProjet.values()).map((p) => ({
        projet: p.projet,
        client: p.client,
        encaissements: eur(p.encaissements),
        decaissements: eur(p.decaissements),
        marge: eur(p.encaissements - p.decaissements),
      }));

      // Totaux du mois = régie + forfait (comme le dashboard).
      const caForfait = encMois.reduce((s, e) => s + num(e.montant), 0);
      const coutForfait = decMois.reduce((s, d) => s + num(d.montant), 0);
      const totalCa = eur(missionsDetail.reduce((s, l) => s + l.ca, 0) + caForfait);
      const totalCout = eur(missionsDetail.reduce((s, l) => s + l.cout, 0) + coutForfait);
      const totalMarge = eur(totalCa - totalCout);

      return json({
        mois,
        indicateurs: {
          ca: totalCa,
          cout: totalCout,
          marge: totalMarge,
          tauxMarge: totalCa > 0 ? Math.round((totalMarge / totalCa) * 1000) / 1000 : 0,
        },
        missions: missionsDetail,
        projets: projetsDetail,
        jalons: jalMois.map((j) => ({ projet: j.projetNom, date: j.date, libelle: j.libelle })),
      });
    }
  );

  // 7. Statistiques de pilotage (réalisé + prévisionnel par mois) -------------
  server.registerTool(
    "statistiques",
    {
      title: "Statistiques de pilotage",
      description:
        "Vue mensuelle de pilotage. Renvoie le RÉALISÉ (encaissements/décaissements déjà passés, par mois) et le PRÉVISIONNEL (marge attendue par mois, en valeur max et pondérée par la fiabilité de paiement) sur une fenêtre. Sans paramètres : du mois courant aux 11 mois suivants.",
      inputSchema: {
        debut: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Premier mois du prévisionnel (AAAA-MM). Défaut : mois courant."),
        fin: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Dernier mois du prévisionnel (AAAA-MM). Défaut : début + 11 mois."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ debut, fin }) => {
      const maintenant = new Date();
      const debutParsed = debut ? parseMois(debut) : { annee: maintenant.getUTCFullYear(), mois: maintenant.getUTCMonth() + 1 };
      if (!debutParsed) return erreur(`Mois de début invalide : « ${debut} ».`);
      const finDefaut = ajouterMois(debutParsed.annee, debutParsed.mois, 11);
      const finParsed = fin ? parseMois(fin) : finDefaut;
      if (!finParsed) return erreur(`Mois de fin invalide : « ${fin} ».`);

      const debutPrevisionnel = premierJourDuMois(debutParsed.annee, debutParsed.mois);
      const finPrevisionnel = dernierJourDuMois(finParsed.annee, finParsed.mois);

      const [affs, encs, decs] = await Promise.all([
        db
          .select({
            date: affectations.date,
            tjmAchat: affectations.tjmAchat,
            tjmVente: affectations.tjmVente,
            freelancePrenom: freelances.prenom,
            freelanceNom: freelances.nom,
            missionNom: missions.nom,
            clientNom: clients.nom,
          })
          .from(affectations)
          .innerJoin(missions, eq(affectations.missionId, missions.id))
          .innerJoin(clients, eq(missions.clientId, clients.id))
          .innerJoin(freelances, eq(affectations.freelanceId, freelances.id)),
        db
          .select({
            date: encaissements.date,
            montant: encaissements.montant,
            statut: encaissements.statut,
            fiabilite: encaissements.fiabilite,
            projetNom: projets.nom,
            clientNom: clients.nom,
            libelle: encaissements.libelle,
          })
          .from(encaissements)
          .innerJoin(projets, eq(encaissements.projetId, projets.id))
          .innerJoin(clients, eq(projets.clientId, clients.id)),
        db
          .select({
            date: decaissements.date,
            montant: decaissements.montant,
            statut: decaissements.statut,
            projetNom: projets.nom,
            clientNom: clients.nom,
            freelancePrenom: freelances.prenom,
            freelanceNom: freelances.nom,
            libelle: decaissements.libelle,
          })
          .from(decaissements)
          .innerJoin(projets, eq(decaissements.projetId, projets.id))
          .innerJoin(clients, eq(projets.clientId, clients.id))
          .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id)),
      ]);

      const affectationsPilotage: AffectationPilotage[] = affs.map((a) => ({
        date: a.date,
        tjmAchat: a.tjmAchat,
        tjmVente: a.tjmVente,
        freelanceNom: nomComplet(a.freelancePrenom, a.freelanceNom),
        missionNom: a.missionNom,
        clientNom: a.clientNom,
      }));
      const encaissementsPilotage: EncaissementPilotage[] = encs.map((e) => ({
        date: e.date,
        montant: e.montant,
        statut: e.statut,
        fiabilite: e.fiabilite,
        projetNom: e.projetNom,
        clientNom: e.clientNom,
        libelle: e.libelle,
      }));
      const decaissementsPilotage: DecaissementPilotage[] = decs.map((d) => ({
        date: d.date,
        montant: d.montant,
        statut: d.statut,
        projetNom: d.projetNom,
        clientNom: d.clientNom,
        freelanceNom: nomComplet(d.freelancePrenom, d.freelanceNom),
        libelle: d.libelle,
      }));

      const { realise, previsionnel } = calculerPilotageMensuel({
        debutPrevisionnel,
        finPrevisionnel,
        affectations: affectationsPilotage,
        encaissements: encaissementsPilotage,
        decaissements: decaissementsPilotage,
      });

      return json({
        fenetrePrevisionnel: { debut: `${debutParsed.annee}-${String(debutParsed.mois).padStart(2, "0")}`, fin: `${finParsed.annee}-${String(finParsed.mois).padStart(2, "0")}` },
        realise: realise.map((r) => ({ mois: r.cle, ca: r.ca, cout: r.cout, marge: r.marge, tauxMarge: Math.round(r.taux * 1000) / 1000 })),
        previsionnel: previsionnel.map((p) => ({
          mois: p.cle,
          caMax: p.caMax,
          caProbable: p.caProb,
          charges: p.charges,
          margeMax: p.margeMax,
          margeProbable: p.margeProb,
          cumulMargeMax: p.cumulMax,
          cumulMargeProbable: p.cumulProb,
        })),
      });
    }
  );

  // 8. Recherche libre -------------------------------------------------------
  server.registerTool(
    "rechercher",
    {
      title: "Recherche libre",
      description:
        "Recherche par nom (insensible à la casse) à travers les freelances, clients, missions (prestas) et projets. Utile pour retrouver l'identifiant d'une entité avant d'appeler un autre outil.",
      inputSchema: {
        texte: z.string().min(1).describe("Texte à rechercher dans les noms."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ texte }) => {
      const motif = `%${texte}%`;
      const [freelancesTrouves, clientsTrouves, missionsTrouvees, projetsTrouves] = await Promise.all([
        db
          .select({ id: freelances.id, prenom: freelances.prenom, nom: freelances.nom, actif: freelances.actif })
          .from(freelances)
          .where(or(ilike(freelances.prenom, motif), ilike(freelances.nom, motif)))
          .limit(25),
        db
          .select({ id: clients.id, nom: clients.nom, actif: clients.actif })
          .from(clients)
          .where(ilike(clients.nom, motif))
          .limit(25),
        db
          .select({ id: missions.id, nom: missions.nom, freelancePrenom: freelances.prenom, freelanceNom: freelances.nom, clientNom: clients.nom, actif: missions.actif })
          .from(missions)
          .innerJoin(freelances, eq(missions.freelanceId, freelances.id))
          .innerJoin(clients, eq(missions.clientId, clients.id))
          .where(ilike(missions.nom, motif))
          .limit(25),
        db
          .select({ id: projets.id, nom: projets.nom, clientNom: clients.nom, actif: projets.actif })
          .from(projets)
          .innerJoin(clients, eq(projets.clientId, clients.id))
          .where(ilike(projets.nom, motif))
          .limit(25),
      ]);

      return json({
        freelances: freelancesTrouves.map((f) => ({ id: f.id, nom: nomComplet(f.prenom, f.nom), actif: f.actif })),
        clients: clientsTrouves,
        missions: missionsTrouvees.map((m) => ({
          id: m.id,
          nom: m.nom,
          freelance: nomComplet(m.freelancePrenom, m.freelanceNom),
          client: m.clientNom,
          actif: m.actif,
        })),
        projets: projetsTrouves,
      });
    }
  );
}
