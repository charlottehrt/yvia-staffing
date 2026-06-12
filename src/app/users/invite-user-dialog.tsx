"use client";

import { useState } from "react";
import { Copy, UserPlus } from "lucide-react";
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
import type { ResultatInvitation } from "./actions";

export function InviteUserDialog({
  action,
}: {
  action: (formData: FormData) => Promise<ResultatInvitation>;
}) {
  const [open, setOpen] = useState(false);
  const [lien, setLien] = useState<string | null>(null);

  async function copier() {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie impossible, sélectionnez le lien manuellement.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(valeur) => {
        setOpen(valeur);
        if (!valeur) setLien(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <UserPlus />
            Inviter
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
        </DialogHeader>

        <form
          action={async (formData) => {
            const res = await action(formData);
            if (res.ok && res.token) {
              setLien(`${window.location.origin}/invitation/${res.token}`);
              toast.success("Invitation créée.");
            } else {
              toast.error(res.message ?? "Une erreur est survenue.");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email *</Label>
            <Input id="invite-email" name="email" type="email" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-prenom">Prénom</Label>
              <Input id="invite-prenom" name="prenom" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-nom">Nom</Label>
              <Input id="invite-nom" name="nom" />
            </div>
          </div>

          {lien ? (
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <Label htmlFor="invite-link">Lien invitation</Label>
              <div className="flex gap-2">
                <Input id="invite-link" value={lien} readOnly className="min-w-0" />
                <Button type="button" variant="outline" size="icon" onClick={copier}>
                  <Copy />
                  <span className="sr-only">Copier le lien</span>
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit">Créer invitation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
