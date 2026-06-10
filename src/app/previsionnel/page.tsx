import { db } from "@/db";
import { projets, clients, encaissements, decaissements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatPourcent, formatMois } from "@/lib/format";
import {
  calculPrevisionnelProjet,
  resoudreFiabilite,
  probaDe,
  labelFiabilite,
  type Recette,
  type Cout,
} from "@/lib/calculs/previsionnel";
import { SousOnglets, ONGLETS_FINANCES } from "@/app/sous-onglets";

const arrondi = (n: number) => Math.round(n * 100) / 100;

export default async function PagePrevisionnel() {
  // Projets actifs + fiabilité du projet et du client (pour la cascade).
  const projetsActifs = await db
    .select({
      id: projets.id,
      nom: projets.nom,
      budget: projets.budget,
      fiabiliteDefaut: projets.fiabiliteDefaut,
      clientNom: clients.nom,
      clientFiabilite: clients.fiabiliteDefaut,
    })
    .from(projets)
    .innerJoin(clients, eq(projets.clientId, clients.id))
    .where(eq(projets.actif, true))
    .orderBy(projets.nom);

  const encRows = await db
    .select({
      projetId: encaissements.projetId,
      date: encaissements.date,
      montant: encaissements.montant,
      statut: encaissements.statut,
      fiabilite: encaissements.fiabilite,
    })
    .from(encaissements);

  const decRows = await db
    .select({
      projetId: decaissements.projetId,
      date: decaissements.date,
      montant: decaissements.montant,
      statut: decaissements.statut,
    })
    .from(decaissements);

  // Regroupement par projet.
  const recettesParProjet = new Map<number, (Recette & { date: string })[]>();
  for (const e of encRows) {
    const arr = recettesParProjet.get(e.projetId) ?? [];
    arr.push({ montant: Number(e.montant), statut: e.statut, fiabilite: e.fiabilite, date: e.date });
    recettesParProjet.set(e.projetId, arr);
  }
  const coutsParProjet = new Map<number, (Cout & { date: string })[]>();
  for (const d of decRows) {
    const arr = coutsParProjet.get(d.projetId) ?? [];
    arr.push({ montant: Number(d.montant), statut: d.statut, date: d.date });
    coutsParProjet.set(d.projetId, arr);
  }

  // Calcul par projet (les 3 scénarios) + fiabilité par défaut appliquée.
  const lignes = projetsActifs.map((p) => {
    const recettes = recettesParProjet.get(p.id) ?? [];
    const couts = coutsParProjet.get(p.id) ?? [];
    const prev = calculPrevisionnelProjet(recettes, couts, p.fiabiliteDefaut, p.clientFiabilite);
    const fiabiliteParDefaut = resoudreFiabilite(null, p.fiabiliteDefaut, p.clientFiabilite);
    return {
      id: p.id,
      nom: p.nom,
      clientNom: p.clientNom,
      budget: Number(p.budget),
      restePrevu: arrondi(prev.caOptimiste - prev.encaisse),
      fiabiliteLabel: labelFiabilite(fiabiliteParDefaut),
      ...prev,
    };
  });

  // Totaux portefeuille.
  const tot = lignes.reduce(
    (s, l) => ({
      caOptimiste: s.caOptimiste + l.caOptimiste,
      caPondere: s.caPondere + l.caPondere,
      caSecurise: s.caSecurise + l.caSecurise,
      coutTotal: s.coutTotal + l.coutTotal,
      margePondere: s.margePondere + l.margePondere,
    }),
    { caOptimiste: 0, caPondere: 0, caSecurise: 0, coutTotal: 0, margePondere: 0 }
  );
  const partSecurisee = tot.caOptimiste > 0 ? tot.caSecurise / tot.caOptimiste : 0;

  // --- Frise de trésorerie mensuelle (tout le portefeuille) ---
  const fiabiliteProjet = new Map(
    projetsActifs.map((p) => [p.id, { p: p.fiabiliteDefaut, c: p.clientFiabilite }])
  );
  const mois = new Map<string, { entrees: number; sorties: number }>();
  const ajout = (cle: string, entrees: number, sorties: number) => {
    const m = mois.get(cle) ?? { entrees: 0, sorties: 0 };
    m.entrees += entrees;
    m.sorties += sorties;
    mois.set(cle, m);
  };
  for (const e of encRows) {
    const cle = e.date.slice(0, 7);
    if (e.statut === "prevu") {
      const f = fiabiliteProjet.get(e.projetId);
      const proba = probaDe(resoudreFiabilite(e.fiabilite, f?.p ?? null, f?.c ?? null));
      ajout(cle, Number(e.montant) * proba, 0); // recette prévue pondérée
    } else {
      ajout(cle, Number(e.montant), 0); // recette encaissée (certaine)
    }
  }
  for (const d of decRows) ajout(d.date.slice(0, 7), 0, Number(d.montant)); // coûts à 100 %

  // Liste continue de mois, du plus ancien au plus récent, avec trésorerie cumulée.
  const cles = [...mois.keys()].sort();
  const friseLignes: { cle: string; entrees: number; sorties: number; flux: number; cumul: number }[] = [];
  if (cles.length > 0) {
    const [aDeb, mDeb] = cles[0].split("-").map(Number);
    const [aFin, mFin] = cles[cles.length - 1].split("-").map(Number);
    let cumul = 0;
    let a = aDeb;
    let m = mDeb;
    while (a < aFin || (a === aFin && m <= mFin)) {
      const cle = `${a}-${String(m).padStart(2, "0")}`;
      const data = mois.get(cle) ?? { entrees: 0, sorties: 0 };
      const flux = data.entrees - data.sorties;
      cumul += flux;
      friseLignes.push({
        cle,
        entrees: arrondi(data.entrees),
        sorties: arrondi(data.sorties),
        flux: arrondi(flux),
        cumul: arrondi(cumul),
      });
      if (m === 12) {
        a += 1;
        m = 1;
      } else {
        m += 1;
      }
    }
  }

  return (
    <div className="space-y-6">
      <SousOnglets onglets={ONGLETS_FINANCES} />
      <h1 className="font-display text-3xl">Prévisionnel</h1>

      <p className="text-sm text-muted-foreground">
        Estimation pondérée par la probabilité de paiement des clients (forfait). Les recettes
        prévues sont pondérées par leur fiabilité ; les coûts comptent à 100 %. Le chiffre « pondéré »
        est un indicateur de pilotage à l’échelle du portefeuille, pas une vérité projet par projet.
      </p>

      {/* Indicateurs portefeuille */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Indicateur titre="CA optimiste" valeur={formatEuro(arrondi(tot.caOptimiste))} />
        <Indicateur titre="CA pondéré" valeur={formatEuro(arrondi(tot.caPondere))} />
        <Indicateur titre="CA sécurisé" valeur={formatEuro(arrondi(tot.caSecurise))} />
        <Indicateur titre="Coût prévu" valeur={formatEuro(arrondi(tot.coutTotal))} />
        <Indicateur titre="Marge pondérée" valeur={formatEuro(arrondi(tot.margePondere))} />
        <Indicateur titre="% du CA sécurisé" valeur={formatPourcent(partSecurisee)} />
      </div>

      {/* Détail par projet */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par projet</CardTitle>
        </CardHeader>
        <CardContent>
          {lignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun projet forfait actif. Créez un projet et son échéancier pour voir le prévisionnel.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Fiabilité</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Encaissé</TableHead>
                  <TableHead className="text-right">Reste prévu</TableHead>
                  <TableHead className="text-right">CA pondéré</TableHead>
                  <TableHead className="text-right">Coût prévu</TableHead>
                  <TableHead className="text-right">Marge pondérée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nom}</TableCell>
                    <TableCell>{l.clientNom}</TableCell>
                    <TableCell className="text-muted-foreground">{l.fiabiliteLabel}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.budget)}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.encaisse)}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.restePrevu)}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.caPondere)}</TableCell>
                    <TableCell className="text-right">{formatEuro(l.coutTotal)}</TableCell>
                    <TableCell className={`text-right ${l.margePondere < 0 ? "text-rose-600" : ""}`}>
                      {formatEuro(l.margePondere)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6} className="font-medium">
                    Total portefeuille
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatEuro(arrondi(tot.caPondere))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatEuro(arrondi(tot.coutTotal))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatEuro(arrondi(tot.margePondere))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Frise de trésorerie */}
      <Card>
        <CardHeader>
          <CardTitle>Trésorerie prévisionnelle (mois par mois)</CardTitle>
        </CardHeader>
        <CardContent>
          {friseLignes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune échéance datée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Entrées pondérées</TableHead>
                  <TableHead className="text-right">Sorties</TableHead>
                  <TableHead className="text-right">Flux net</TableHead>
                  <TableHead className="text-right">Trésorerie cumulée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {friseLignes.map((l) => {
                  const [a, m] = l.cle.split("-").map(Number);
                  return (
                    <TableRow key={l.cle}>
                      <TableCell className="font-medium capitalize">{formatMois(a, m)}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {formatEuro(l.entrees)}
                      </TableCell>
                      <TableCell className="text-right text-rose-600">
                        {formatEuro(l.sorties)}
                      </TableCell>
                      <TableCell className={`text-right ${l.flux < 0 ? "text-rose-600" : ""}`}>
                        {formatEuro(l.flux)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${l.cumul < 0 ? "text-rose-600" : ""}`}>
                        {formatEuro(l.cumul)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Indicateur({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-normal text-muted-foreground">{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl">{valeur}</p>
      </CardContent>
    </Card>
  );
}
