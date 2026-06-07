"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type MissionResume = {
  freelanceNom: string;
};

export function ClientDetailDialog({
  nom,
  missions,
}: {
  nom: string;
  missions: MissionResume[];
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{nom}</DialogTitle>
        </DialogHeader>

        {missions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun freelance placé chez ce client pour l’instant.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Freelances placés :</p>
            {missions.map((m, i) => (
              <div key={i} className="rounded-lg border border-border px-3 py-2 font-medium">
                {m.freelanceNom}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
