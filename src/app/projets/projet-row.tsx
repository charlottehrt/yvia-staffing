"use client";
// Ligne de projet entièrement cliquable (ouvre le drawer de gestion du projet),
// sauf la cellule Client qui ouvre son propre drawer.

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatEuro } from "@/lib/format";
import { labelStatutCommercial } from "@/lib/projets/statut-commercial";
import { EntityLink } from "@/app/_drawer/drawer-stack";
import { ProjetDetailDialog } from "./projet-detail-dialog";

type Evenement = {
  id: number;
  date: string;
  montant: string;
  libelle: string | null;
  statut: string;
  fiabilite: string | null;
};
type Decaissement = Evenement & { freelanceNom: string };
type Jalon = { id: number; date: string; libelle: string };

type Projet = {
  id: number;
  nom: string;
  clientId: number;
  clientNom: string;
  budget: string;
  statutCommercial: string;
  montantEnvisage: string | null;
  fiabiliteDefaut: string | null;
  clientFiabilite: string | null;
  actif: boolean;
};

export function ProjetRow({
  projet,
  encaissements,
  decaissements,
  jalons,
  freelancesActifs,
}: {
  projet: Projet;
  encaissements: Evenement[];
  decaissements: Decaissement[];
  jalons: Jalon[];
  freelancesActifs: { id: number; prenom: string; nom: string }[];
}) {
  const [open, setOpen] = useState(false);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Colonnes = réalisé uniquement (le prévu vit dans le prévisionnel).
  const somme = (arr: { montant: string; statut: string }[]) =>
    arr.filter((x) => x.statut !== "prevu").reduce((s, x) => s + Number(x.montant), 0);
  const totalEnc = somme(encaissements);
  const totalDec = somme(decaissements);
  const marge = totalEnc - totalDec;
  const reste = Number(projet.budget) - totalEnc;

  return (
    <>
      <TableRow onClick={() => setOpen(true)} className="cursor-pointer">
        <TableCell className="font-medium">{projet.nom}</TableCell>
        <TableCell onClick={stop}>
          <EntityLink type="client" id={projet.clientId} className="hover:text-primary hover:underline">
            {projet.clientNom}
          </EntityLink>
        </TableCell>
        <TableCell>{labelStatutCommercial(projet.statutCommercial)}</TableCell>
        <TableCell className="text-right">
          {projet.montantEnvisage ? formatEuro(Number(projet.montantEnvisage)) : "-"}
        </TableCell>
        <TableCell className="text-right">{formatEuro(Number(projet.budget))}</TableCell>
        <TableCell className="text-right">{formatEuro(totalEnc)}</TableCell>
        <TableCell className="text-right">{formatEuro(totalDec)}</TableCell>
        <TableCell className={`text-right ${marge < 0 ? "text-rose-600" : ""}`}>
          {formatEuro(marge)}
        </TableCell>
        <TableCell className="text-right">{formatEuro(reste)}</TableCell>
      </TableRow>

      <ProjetDetailDialog
        open={open}
        onOpenChange={setOpen}
        projet={projet}
        encaissements={encaissements}
        decaissements={decaissements}
        jalons={jalons}
        freelancesActifs={freelancesActifs}
      />
    </>
  );
}
