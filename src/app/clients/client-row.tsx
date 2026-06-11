"use client";
// Ligne de client entièrement cliquable : ouvre le drawer du client.

import { TableCell, TableRow } from "@/components/ui/table";
import { formatEuro } from "@/lib/format";
import { useDrawer } from "@/app/_drawer/drawer-stack";
import type { EntiteRef } from "@/app/_drawer/types";
import type { StatsClient } from "./client-stats";

type ClientRowProps = StatsClient & {
  id: number;
  nom: string;
};

type ClientRowViewProps = ClientRowProps & {
  onOpen: (ref: EntiteRef) => void;
};

export function ClientRowView({
  id,
  nom,
  caTotal,
  caMois,
  margeTotale,
  onOpen,
}: ClientRowViewProps) {
  return (
    <TableRow onClick={() => onOpen({ type: "client", id })} className="cursor-pointer">
      <TableCell className="font-medium">{nom}</TableCell>
      <TableCell className="text-right">{formatEuro(caTotal)}</TableCell>
      <TableCell className="text-right">{formatEuro(caMois)}</TableCell>
      <TableCell className={`text-right ${margeTotale < 0 ? "text-rose-600" : ""}`}>
        {formatEuro(margeTotale)}
      </TableCell>
    </TableRow>
  );
}

export function ClientRow({ id, nom, caTotal, caMois, margeTotale }: ClientRowProps) {
  const { ouvrir } = useDrawer();

  return (
    <ClientRowView
      id={id}
      nom={nom}
      caTotal={caTotal}
      caMois={caMois}
      margeTotale={margeTotale}
      onOpen={ouvrir}
    />
  );
}
