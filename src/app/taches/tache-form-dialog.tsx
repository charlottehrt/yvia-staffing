"use client";
// "use client" : ouvre/ferme une fenêtre, il s'exécute donc dans le navigateur.
// Sert à la fois à créer une tâche (sans `tache`) et à la renommer (avec `tache`).

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TacheCree, Resultat } from "./actions";

type Tache = {
  id: number;
  nom: string;
};

export function TacheFormDialog({
  action,
  tache,
  titre,
  trigger,
  onCreated,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  tache?: Tache; // si fourni = renommage, sinon = création
  titre: string;
  trigger: React.ReactElement;
  onCreated?: (tache: TacheCree) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>

        <form
          // Remonte le formulaire si les valeurs changent (ex : après enregistrement
          // et revalidation), au lieu de muter un champ déjà initialisé.
          key={tache ? `${tache.id}:${tache.nom}` : "new"}
          action={async (formData) => {
            const res = await action(formData);
            if (res.ok) {
              if (!tache && "tache" in res && res.tache) onCreated?.(res.tache);
              toast.success("Tâche enregistrée.");
              setOpen(false);
            } else {
              toast.error(res.message ?? "Une erreur est survenue.");
            }
          }}
          className="space-y-4"
        >
          {tache ? <input type="hidden" name="id" value={tache.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="nom">Nom de la tâche *</Label>
            <Input id="nom" name="nom" defaultValue={tache?.nom ?? ""} required autoFocus />
          </div>

          <DialogFooter>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
