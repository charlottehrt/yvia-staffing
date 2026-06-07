"use client";
// "use client" : ce composant a besoin d'interactivité (ouvrir/fermer la fenêtre),
// il s'exécute donc dans le navigateur.

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
import type { Resultat } from "./actions";

type Client = {
  id: number;
  nom: string;
};

export function ClientFormDialog({
  action,
  client,
  titre,
  trigger,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  client?: Client; // si fourni = modification, sinon = création
  titre: string;
  trigger: React.ReactElement;
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
          action={async (formData) => {
            const res = await action(formData);
            if (res.ok) {
              toast.success("Client enregistré.");
              setOpen(false);
            } else {
              toast.error(res.message ?? "Une erreur est survenue.");
            }
          }}
          className="space-y-4"
        >
          {client ? <input type="hidden" name="id" value={client.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="nom">Société *</Label>
            <Input id="nom" name="nom" defaultValue={client?.nom ?? ""} required />
          </div>

          <DialogFooter>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
