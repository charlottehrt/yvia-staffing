import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { exigerSession } from "@/lib/auth/server";
import { chargesFixes, chargesFixesValeurs } from "@/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListViewToolbar } from "@/components/list-view-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatMois } from "@/lib/format";
import { cn } from "@/lib/utils";
import { construireTableauCharges } from "@/lib/charges-fixes/calculs";
import { ChargeFixeFormDialog } from "./charge-fixe-form-dialog";
import { CelluleCharge } from "./cellule-charge";
import { ToggleActifChargeButton } from "./toggle-actif-charge-button";
import { creerChargeFixe, modifierChargeFixe } from "./actions";

const filtres = [
  { slug: "actives", label: "Actives" },
  { slug: "archivees", label: "Archivées" },
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

// "AAAA-MM" -> "janv.", "févr."…
function moisCourt(moisISO: string): string {
  const [a, m] = moisISO.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
    new Date(Date.UTC(a, m - 1, 1))
  );
}

// Libellé de période d'une charge : "depuis mars 2026" ou "mars 2026 → août 2026".
function periode(dateDebut: string, dateFin: string | null): string {
  const debut = formatMois(Number(dateDebut.slice(0, 4)), Number(dateDebut.slice(5, 7)));
  if (!dateFin) return `depuis ${debut}`;
  const fin = formatMois(Number(dateFin.slice(0, 4)), Number(dateFin.slice(5, 7)));
  return `${debut} → ${fin}`;
}

export default async function PageChargesFixes({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; statut?: string }>;
}) {
  await exigerSession();
  const { annee: anneeParam, statut: filtreActif = "actives" } = await searchParams;

  const maintenant = new Date();
  const annee = Number(anneeParam) || maintenant.getUTCFullYear();
  const actives = filtreActif !== "archivees";
  const moisCourantISO = `${maintenant.getUTCFullYear()}-${pad2(maintenant.getUTCMonth() + 1)}`;

  const charges = await db
    .select({
      id: chargesFixes.id,
      libelle: chargesFixes.libelle,
      montantMensuel: chargesFixes.montantMensuel,
      dateDebut: chargesFixes.dateDebut,
      dateFin: chargesFixes.dateFin,
      actif: chargesFixes.actif,
    })
    .from(chargesFixes)
    .where(eq(chargesFixes.actif, actives))
    .orderBy(chargesFixes.libelle);

  const ids = charges.map((c) => c.id);
  const valeurs = ids.length
    ? await db
        .select({
          chargeFixeId: chargesFixesValeurs.chargeFixeId,
          mois: chargesFixesValeurs.mois,
          montant: chargesFixesValeurs.montant,
        })
        .from(chargesFixesValeurs)
        .where(
          and(
            inArray(chargesFixesValeurs.chargeFixeId, ids),
            gte(chargesFixesValeurs.mois, `${annee}-01`),
            lte(chargesFixesValeurs.mois, `${annee}-12`)
          )
        )
    : [];

  const tableau = construireTableauCharges({ charges, valeurs, annee });
  const moyenneMensuelle = tableau.totalGeneral / 12;

  return (
    <div className="space-y-6">
      <ListViewToolbar
        action={
          <ChargeFixeFormDialog
            action={creerChargeFixe}
            titre="Nouvelle charge fixe"
            trigger={<Button>Nouvelle charge fixe</Button>}
          />
        }
      >
        {filtres.map((f) => (
          <Link
            key={f.slug}
            href={`/charges-fixes?statut=${f.slug}&annee=${annee}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              filtreActif === f.slug
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </ListViewToolbar>

      {/* Indicateurs de l'année affichée */}
      <div className="grid grid-cols-2 gap-4">
        <Kpi titre={`Total ${annee}`} valeur={formatEuro(tableau.totalGeneral)} />
        <Kpi titre="Moyenne mensuelle" valeur={formatEuro(moyenneMensuelle)} />
      </div>

      {/* Navigation par année */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link
                href={`/charges-fixes?statut=${filtreActif}&annee=${annee - 1}`}
                aria-label="Année précédente"
              >
                <ChevronLeft />
              </Link>
            }
          />
          <span className="min-w-16 text-center text-sm font-medium">{annee}</span>
          <Button
            variant="outline"
            size="icon-sm"
            nativeButton={false}
            render={
              <Link
                href={`/charges-fixes?statut=${filtreActif}&annee=${annee + 1}`}
                aria-label="Année suivante"
              >
                <ChevronRight />
              </Link>
            }
          />
        </div>
      </div>

      <Card>
        <CardContent>
          {tableau.lignes.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {actives
                ? "Aucune charge fixe. Créez votre première charge récurrente (abonnement SaaS, loyer…) avec le bouton « Nouvelle charge fixe »."
                : "Aucune charge archivée."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-20 min-w-52 bg-secondary">
                    Charge fixe
                  </TableHead>
                  {tableau.mois.map((m) => (
                    <TableHead
                      key={m}
                      className={cn(
                        "text-right capitalize",
                        m === moisCourantISO && "text-primary"
                      )}
                    >
                      {moisCourt(m)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableau.lignes.map((ligne) => (
                  <TableRow key={ligne.id}>
                    <TableCell className="sticky left-0 z-10 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <ChargeFixeFormDialog
                            action={modifierChargeFixe}
                            titre="Modifier la charge fixe"
                            charge={{
                              id: ligne.id,
                              libelle: ligne.libelle,
                              montantMensuel: String(ligne.montantMensuel),
                              dateDebut: ligne.dateDebut,
                              dateFin: ligne.dateFin,
                            }}
                            trigger={
                              <button
                                type="button"
                                className="text-left font-medium hover:text-primary hover:underline"
                              >
                                {ligne.libelle}
                              </button>
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            {formatEuro(ligne.montantMensuel)}/mois ·{" "}
                            {periode(ligne.dateDebut, ligne.dateFin)}
                          </p>
                        </div>
                        <ToggleActifChargeButton
                          id={ligne.id}
                          libelle={ligne.libelle}
                          actif={ligne.actif}
                        />
                      </div>
                    </TableCell>
                    {ligne.cellules.map((cell) => (
                      <CelluleCharge
                        key={cell.mois}
                        chargeFixeId={ligne.id}
                        mois={cell.mois}
                        active={cell.active}
                        saisie={cell.saisie}
                        defaut={cell.defaut}
                      />
                    ))}
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatEuro(ligne.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-muted font-medium">Total</TableCell>
                  {tableau.totauxMois.map((t, i) => (
                    <TableCell key={i} className="text-right tabular-nums">
                      {formatEuro(t)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatEuro(tableau.totalGeneral)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-normal text-muted-foreground">{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl sm:text-3xl">{valeur}</p>
      </CardContent>
    </Card>
  );
}
