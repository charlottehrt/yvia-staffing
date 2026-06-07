"use client";

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

type Freelance = {
  id: number;
  prenom: string;
  nom: string;
};

export function FreelanceFormDialog({
  action,
  freelance,
  titre,
  trigger,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  freelance?: Freelance; // fourni = modification, sinon = création
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
              toast.success("Freelance enregistré.");
              setOpen(false);
            } else {
              toast.error(res.message ?? "Une erreur est survenue.");
            }
          }}
          className="space-y-4"
        >
          {freelance ? <input type="hidden" name="id" value={freelance.id} /> : null}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom *</Label>
              <Input id="prenom" name="prenom" defaultValue={freelance?.prenom ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom *</Label>
              <Input id="nom" name="nom" defaultValue={freelance?.nom ?? ""} required />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
