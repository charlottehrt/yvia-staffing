"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type MissionResume = {
  clientNom: string;
};

export function FreelanceDetailDialog({
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
            Ce freelance n’est sur aucune mission (intercontrat).
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Clients et missions :</p>
            {missions.map((m, i) => (
              <div key={i} className="rounded-lg border border-border px-3 py-2 font-medium">
                {m.clientNom}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
