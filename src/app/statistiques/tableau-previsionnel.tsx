"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatEuro, formatJours, formatMois, formatPourcent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DetailsPrevisionnel, LignePrevisionnel } from "./pilotage-calculs";

export function TableauPrevisionnel({ lignes }: { lignes: LignePrevisionnel[] }) {
  const [lignesOuvertes, setLignesOuvertes] = useState<Set<string>>(() => new Set());
  const total = totaliserPrevisionnel(lignes);

  function basculer(cle: string) {
    setLignesOuvertes((courant) => {
      const suivant = new Set(courant);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mois</TableHead>
          <TableHead className="text-right">CA max</TableHead>
          <TableHead className="text-right">CA probable</TableHead>
          <TableHead className="text-right">Charges prévues</TableHead>
          <TableHead className="text-right">Marge max</TableHead>
          <TableHead className="text-right">Marge probable</TableHead>
          <TableHead className="text-right">Cumul probable</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l) => {
          const ouvert = lignesOuvertes.has(l.cle);
          const detailsDisponibles = aDesDetails(l.details);
          const mois = formatMois(l.annee, l.mois);

          return (
            <Fragment key={l.cle}>
              <TableRow aria-expanded={ouvert}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${ouvert ? "Masquer" : "Afficher"} les détails de ${mois}`}
                      aria-expanded={ouvert}
                      disabled={!detailsDisponibles}
                      onClick={() => basculer(l.cle)}
                      className={cn(!detailsDisponibles && "opacity-40")}
                    >
                      <ChevronDown className={cn("transition-transform", ouvert && "rotate-180")} />
                    </Button>
                    <span className="capitalize">{mois}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatEuro(l.caMax)}</TableCell>
                <TableCell className="text-right">{formatEuro(l.caProb)}</TableCell>
                <TableCell className="text-right text-rose-600">{formatEuro(l.charges)}</TableCell>
                <TableCell className={`text-right ${l.margeMax < 0 ? "text-rose-600" : ""}`}>
                  {formatEuro(l.margeMax)}
                </TableCell>
                <TableCell className={`text-right ${l.margeProb < 0 ? "text-rose-600" : ""}`}>
                  {formatEuro(l.margeProb)}
                </TableCell>
                <TableCell className={`text-right font-medium ${l.cumulProb < 0 ? "text-rose-600" : ""}`}>
                  {formatEuro(l.cumulProb)}
                </TableCell>
              </TableRow>
              {ouvert ? (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={7} className="p-0 whitespace-normal">
                    <DetailsMois details={l.details} />
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{formatEuro(total.caMax)}</TableCell>
          <TableCell className="text-right">{formatEuro(total.caProb)}</TableCell>
          <TableCell className="text-right">{formatEuro(total.charges)}</TableCell>
          <TableCell className={`text-right ${total.margeMax < 0 ? "text-rose-600" : ""}`}>
            {formatEuro(total.margeMax)}
          </TableCell>
          <TableCell className={`text-right ${total.margeProb < 0 ? "text-rose-600" : ""}`}>
            {formatEuro(total.margeProb)}
          </TableCell>
          <TableCell className={`text-right ${total.cumulProb < 0 ? "text-rose-600" : ""}`}>
            {formatEuro(total.cumulProb)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

function DetailsMois({ details }: { details: DetailsPrevisionnel }) {
  return (
    <div className="grid gap-4 border-t border-border bg-muted/20 p-3 lg:grid-cols-3">
      <BlocDetails titre="Freelances planifiés" vide={details.regie.length === 0 ? "Aucun jour freelance prévu." : null}>
        {details.regie.length ? (
          <div className="space-y-2">
            {details.regie.map((ligne) => (
              <div key={ligne.cle} className="grid gap-1 rounded-md border border-border bg-background p-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ligne.freelanceNom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ligne.missionNom} · {ligne.clientNom}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium">{formatJours(ligne.jours)} j</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <MontantCompact label="CA" valeur={ligne.caMax} />
                  <MontantCompact label="Coût" valeur={ligne.charges} negatif />
                  <MontantCompact label="Marge" valeur={ligne.marge} negatif={ligne.marge < 0} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </BlocDetails>

      <BlocDetails
        titre="Encaissements prévus"
        vide={details.encaissements.length === 0 ? "Aucun encaissement prévu." : null}
      >
        <div className="space-y-2">
          {details.encaissements.map((ligne) => (
            <div
              key={`${ligne.date}-${ligne.projetNom}-${ligne.montant}`}
              className="grid gap-1 rounded-md border border-border bg-background p-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ligne.projetNom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(ligne.date)} · {ligne.clientNom}
                    {ligne.libelle ? ` · ${ligne.libelle}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-medium">{formatEuro(ligne.montant)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Probable : {formatEuro(ligne.montantProbable)} · Fiabilité {formatFiabilite(ligne.fiabilite)}
              </p>
            </div>
          ))}
        </div>
      </BlocDetails>

      <BlocDetails
        titre="Décaissements prévus"
        vide={details.decaissements.length === 0 ? "Aucun décaissement prévu." : null}
      >
        <div className="space-y-2">
          {details.decaissements.map((ligne) => (
            <div
              key={`${ligne.date}-${ligne.projetNom}-${ligne.freelanceNom}-${ligne.montant}`}
              className="grid gap-1 rounded-md border border-border bg-background p-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{ligne.freelanceNom}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(ligne.date)} · {ligne.projetNom} · {ligne.clientNom}
                    {ligne.libelle ? ` · ${ligne.libelle}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-rose-600">{formatEuro(ligne.montant)}</span>
              </div>
            </div>
          ))}
        </div>
      </BlocDetails>
    </div>
  );
}

function BlocDetails({
  titre,
  vide,
  children,
}: {
  titre: string;
  vide: string | null;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titre}</h3>
      {vide ? (
        <p className="rounded-md border border-dashed border-border bg-background px-2 py-3 text-xs text-muted-foreground">
          {vide}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function MontantCompact({
  label,
  valeur,
  negatif = false,
}: {
  label: string;
  valeur: number;
  negatif?: boolean;
}) {
  return (
    <p className="min-w-0">
      <span className="block text-muted-foreground">{label}</span>
      <span className={cn("font-medium", negatif && "text-rose-600")}>{formatEuro(valeur)}</span>
    </p>
  );
}

function aDesDetails(details: DetailsPrevisionnel) {
  return details.regie.length > 0 || details.encaissements.length > 0 || details.decaissements.length > 0;
}

function formatFiabilite(fiabilite: string | null) {
  if (!fiabilite) return formatPourcent(1);
  const n = Number(fiabilite);
  if (Number.isFinite(n)) return formatPourcent(n / 100);
  return fiabilite;
}

function totaliserPrevisionnel(lignes: LignePrevisionnel[]) {
  const total = lignes.reduce(
    (s, l) => ({
      caMax: s.caMax + l.caMax,
      caProb: s.caProb + l.caProb,
      charges: s.charges + l.charges,
      margeMax: s.margeMax + l.margeMax,
      margeProb: s.margeProb + l.margeProb,
    }),
    { caMax: 0, caProb: 0, charges: 0, margeMax: 0, margeProb: 0 }
  );
  return {
    ...total,
    cumulProb: lignes.length ? lignes[lignes.length - 1].cumulProb : 0,
  };
}
