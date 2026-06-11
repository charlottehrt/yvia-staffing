import Link from "next/link";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import { projets, clients, freelances, encaissements, decaissements, jalons } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjetFormDialog } from "./projet-form-dialog";
import { ProjetRow } from "./projet-row";
import { creerProjet } from "./actions";

type Evenement = {
  id: number;
  date: string;
  montant: string;
  libelle: string | null;
  statut: string; // 'encaisse'/'prevu' (recette) ou 'decaisse'/'prevu' (coût)
  fiabilite: string | null; // seulement côté recette
};
type Decaissement = Evenement & { freelanceNom: string };
type Jalon = { id: number; date: string; libelle: string };

export default async function PageProjets({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  await exigerSession();
  const { vue } = await searchParams;
  const archives = vue === "archives";

  const liste = await db
    .select({
      id: projets.id,
      nom: projets.nom,
      budget: projets.budget,
      clientId: projets.clientId,
      clientNom: clients.nom,
      clientFiabilite: clients.fiabiliteDefaut,
      fiabiliteDefaut: projets.fiabiliteDefaut,
      actif: projets.actif,
    })
    .from(projets)
    .innerJoin(clients, eq(projets.clientId, clients.id))
    .where(eq(projets.actif, !archives))
    .orderBy(projets.nom);

  // On récupère TOUT l'échéancier (prévu + réalisé) : le dialogue "Gérer" en a besoin.
  // Les colonnes du tableau, elles, ne compteront que le réalisé (filtré plus bas).
  const encRows = await db
    .select({
      id: encaissements.id,
      projetId: encaissements.projetId,
      date: encaissements.date,
      montant: encaissements.montant,
      libelle: encaissements.libelle,
      statut: encaissements.statut,
      fiabilite: encaissements.fiabilite,
    })
    .from(encaissements);

  const decRows = await db
    .select({
      id: decaissements.id,
      projetId: decaissements.projetId,
      date: decaissements.date,
      montant: decaissements.montant,
      libelle: decaissements.libelle,
      statut: decaissements.statut,
      prenom: freelances.prenom,
      nom: freelances.nom,
    })
    .from(decaissements)
    .innerJoin(freelances, eq(decaissements.freelanceId, freelances.id));

  const encParProjet = new Map<number, Evenement[]>();
  for (const e of encRows) {
    const arr = encParProjet.get(e.projetId) ?? [];
    arr.push({ id: e.id, date: e.date, montant: e.montant, libelle: e.libelle, statut: e.statut, fiabilite: e.fiabilite });
    encParProjet.set(e.projetId, arr);
  }
  const decParProjet = new Map<number, Decaissement[]>();
  for (const d of decRows) {
    const arr = decParProjet.get(d.projetId) ?? [];
    arr.push({
      id: d.id,
      date: d.date,
      montant: d.montant,
      libelle: d.libelle,
      statut: d.statut,
      fiabilite: null,
      freelanceNom: `${d.prenom} ${d.nom}`,
    });
    decParProjet.set(d.projetId, arr);
  }

  const jalRows = await db
    .select({
      id: jalons.id,
      projetId: jalons.projetId,
      date: jalons.date,
      libelle: jalons.libelle,
    })
    .from(jalons);
  const jalParProjet = new Map<number, Jalon[]>();
  for (const j of jalRows) {
    const arr = jalParProjet.get(j.projetId) ?? [];
    arr.push({ id: j.id, date: j.date, libelle: j.libelle });
    jalParProjet.set(j.projetId, arr);
  }

  // Listes pour les formulaires.
  const clientsListe = await db
    .select({ id: clients.id, nom: clients.nom })
    .from(clients)
    .where(eq(clients.actif, true))
    .orderBy(clients.nom);
  const freelancesActifs = await db
    .select({ id: freelances.id, prenom: freelances.prenom, nom: freelances.nom })
    .from(freelances)
    .where(eq(freelances.actif, true))
    .orderBy(freelances.nom);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {clientsListe.length > 0 ? (
          <ProjetFormDialog
            action={creerProjet}
            titre="Nouveau projet"
            clientsListe={clientsListe}
            trigger={<Button>Nouveau projet</Button>}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Ajoutez d’abord un client.</p>
        )}
      </div>

      {/* Onglets Actifs / Archives */}
      <div className="flex gap-1">
        <Link
          href="/projets"
          className={`rounded-md px-3 py-1.5 text-sm ${
            !archives ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Actifs
        </Link>
        <Link
          href="/projets?vue=archives"
          className={`rounded-md px-3 py-1.5 text-sm ${
            archives ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Archives
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {liste.length} projet{liste.length > 1 ? "s" : ""}
            {archives ? " archivé" + (liste.length > 1 ? "s" : "") : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {archives ? "Aucun projet archivé." : "Aucun projet pour l’instant."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Décaissé</TableHead>
                  <TableHead className="text-right">Marge</TableHead>
                  <TableHead className="text-right">Reste à facturer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liste.map((p) => (
                  <ProjetRow
                    key={p.id}
                    projet={{
                      id: p.id,
                      nom: p.nom,
                      clientId: p.clientId,
                      clientNom: p.clientNom,
                      budget: p.budget,
                      fiabiliteDefaut: p.fiabiliteDefaut,
                      clientFiabilite: p.clientFiabilite,
                      actif: p.actif,
                    }}
                    encaissements={encParProjet.get(p.id) ?? []}
                    decaissements={decParProjet.get(p.id) ?? []}
                    jalons={jalParProjet.get(p.id) ?? []}
                    freelancesActifs={freelancesActifs}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
