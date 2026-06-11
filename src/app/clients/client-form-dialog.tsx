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
import type { ClientCree, Resultat } from "./actions";

type Client = {
  id: number;
  nom: string;
};

export function ClientFormDialog({
  action,
  client,
  titre,
  trigger,
  onCreated,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  client?: Client; // si fourni = modification, sinon = création
  titre: string;
  trigger: React.ReactElement;
  onCreated?: (client: ClientCree) => void;
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
          key={client ? `${client.id}:${client.nom}` : "new"}
          action={async (formData) => {
            const res = await action(formData);
            if (res.ok) {
              if (!client && "client" in res && res.client) onCreated?.(res.client);
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
