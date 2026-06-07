"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEuro, formatJours } from "@/lib/format";

type MissionResume = {
  missionNom: string;
  clientNom: string;
  tjmAchat: string;
  tjmVente: string;
  actif: boolean;
};

export function FreelanceDetailDialog({
  nom,
  missions,
  stats,
}: {
  nom: string;
  missions: MissionResume[];
  stats: { jours: number; marge: number };
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button className="text-left font-medium hover:text-primary hover:underline">
            {nom}
          </button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{nom}</DialogTitle>
        </DialogHeader>

        {/* Indicateurs du mois en cours */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Jours posés ce mois</p>
            <p className="font-display text-2xl">{formatJours(stats.jours)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Marge ce mois</p>
            <p className="font-display text-2xl">{formatEuro(stats.marge)}</p>
          </div>
        </div>

        {missions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ce freelance n’est sur aucune mission (intercontrat).
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Missions :</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mission</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">TJM achat</TableHead>
                  <TableHead className="text-right">TJM vente</TableHead>
                  <TableHead className="text-right">Marge/j</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missions.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {m.missionNom}
                      {m.actif ? "" : " (inactive)"}
                    </TableCell>
                    <TableCell>{m.clientNom}</TableCell>
                    <TableCell className="text-right">{formatEuro(Number(m.tjmAchat))}</TableCell>
                    <TableCell className="text-right">{formatEuro(Number(m.tjmVente))}</TableCell>
                    <TableCell className="text-right">
                      {formatEuro(Number(m.tjmVente) - Number(m.tjmAchat))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
