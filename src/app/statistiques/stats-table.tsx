"use client";

import { useState, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatPourcent, formatJours } from "@/lib/format";

export type LigneStat = {
  cle: string;
  label: string;
  ordreLabel: string; // valeur de tri pour la colonne libellé
  ca: number;
  cout: number;
  marge: number;
  taux: number;
  jours: number;
};

type Colonne = "label" | "ca" | "cout" | "marge" | "taux" | "jours";
type Tri = { col: Colonne; asc: boolean } | null;

function Entete({
  col,
  children,
  tri,
  onChangerTri,
  alignRight = true,
}: {
  col: Colonne;
  children: ReactNode;
  tri: Tri;
  onChangerTri: (col: Colonne) => void;
  alignRight?: boolean;
}) {
  const fleche = tri && tri.col === col ? (tri.asc ? " ↑" : " ↓") : "";
  return (
    <TableHead className={alignRight ? "text-right" : undefined}>
      <button
        onClick={() => onChangerTri(col)}
        className="font-medium hover:text-foreground"
      >
        {children}
        {fleche}
      </button>
    </TableHead>
  );
}

export function StatsTable({
  lignes,
  labelColonne,
}: {
  lignes: LigneStat[];
  labelColonne: string;
}) {
  // tri = null : ordre fourni par le serveur (défaut pertinent selon la dimension).
  const [tri, setTri] = useState<Tri>(null);

  const lignesTriees = [...lignes];
  if (tri) {
    lignesTriees.sort((a, b) => {
      const cmp =
        tri.col === "label"
          ? a.ordreLabel < b.ordreLabel
            ? -1
            : a.ordreLabel > b.ordreLabel
              ? 1
              : 0
          : a[tri.col] - b[tri.col];
      return tri.asc ? cmp : -cmp;
    });
  }

  const tot = lignes.reduce(
    (s, l) => ({
      ca: s.ca + l.ca,
      cout: s.cout + l.cout,
      marge: s.marge + l.marge,
      jours: s.jours + l.jours,
    }),
    { ca: 0, cout: 0, marge: 0, jours: 0 }
  );
  const tauxTot = tot.ca > 0 ? tot.marge / tot.ca : 0;

  function changerTri(col: Colonne) {
    setTri((t) => (t && t.col === col ? { col, asc: !t.asc } : { col, asc: col === "label" }));
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <Entete col="label" tri={tri} onChangerTri={changerTri} alignRight={false}>
            {labelColonne}
          </Entete>
          <Entete col="ca" tri={tri} onChangerTri={changerTri}>
            CA
          </Entete>
          <Entete col="cout" tri={tri} onChangerTri={changerTri}>
            Coût
          </Entete>
          <Entete col="marge" tri={tri} onChangerTri={changerTri}>
            Marge
          </Entete>
          <Entete col="taux" tri={tri} onChangerTri={changerTri}>
            Taux
          </Entete>
          <Entete col="jours" tri={tri} onChangerTri={changerTri}>
            Jours
          </Entete>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignesTriees.map((l) => (
          <TableRow key={l.cle}>
            <TableCell className="font-medium">{l.label}</TableCell>
            <TableCell className="text-right">{formatEuro(l.ca)}</TableCell>
            <TableCell className="text-right">{formatEuro(l.cout)}</TableCell>
            <TableCell className="text-right">{formatEuro(l.marge)}</TableCell>
            <TableCell className="text-right">{formatPourcent(l.taux)}</TableCell>
            <TableCell className="text-right">{formatJours(l.jours)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="font-medium">Total</TableCell>
          <TableCell className="text-right font-medium">{formatEuro(tot.ca)}</TableCell>
          <TableCell className="text-right font-medium">{formatEuro(tot.cout)}</TableCell>
          <TableCell className="text-right font-medium">{formatEuro(tot.marge)}</TableCell>
          <TableCell className="text-right font-medium">{formatPourcent(tauxTot)}</TableCell>
          <TableCell className="text-right font-medium">{formatJours(tot.jours)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
