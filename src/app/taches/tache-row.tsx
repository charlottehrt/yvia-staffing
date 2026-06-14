"use client";
// Ligne de tâche cliquable : ouvre le panneau de suivi. Affiche le nom, un aperçu
// du dernier commentaire et le nombre de points de suivi.

import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatDateHeure } from "@/lib/format";
import {
  TacheDetailSheet,
  type TacheDetail,
  type Commentaire,
} from "./tache-detail-sheet";

export function TacheRow({
  tache,
  commentaires,
}: {
  tache: TacheDetail;
  commentaires: Commentaire[]; // triés du plus récent au plus ancien
}) {
  const [open, setOpen] = useState(false);
  const dernier = commentaires[0];

  return (
    <>
      <TableRow onClick={() => setOpen(true)} className="cursor-pointer">
        <TableCell
          className={`font-medium ${tache.termine ? "text-muted-foreground line-through" : ""}`}
        >
          {tache.nom}
        </TableCell>
        <TableCell className="max-w-xs">
          {dernier ? (
            <span className="block truncate text-muted-foreground">{dernier.contenu}</span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums text-muted-foreground">
          {commentaires.length}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap text-muted-foreground">
          {dernier ? formatDateHeure(dernier.creeLe) : formatDateHeure(tache.creeLe)}
        </TableCell>
      </TableRow>

      <TacheDetailSheet
        tache={tache}
        commentaires={commentaires}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
