"use client";

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creerInvitation, supprimerInvitation } from "./actions";

type Invitation = { id: number; email: string; nom: string | null; token: string };

const subscribeOrigin = () => () => {};
const getOriginSnapshot = () => window.location.origin;
const getServerOriginSnapshot = () => "";

export function InviteSection({ invitations }: { invitations: Invitation[] }) {
  const origin = useSyncExternalStore(
    subscribeOrigin,
    getOriginSnapshot,
    getServerOriginSnapshot
  );
  const lien = (token: string) => `${origin}/invitation/${token}`;

  async function copier(token: string) {
    try {
      await navigator.clipboard.writeText(lien(token));
      toast.success("Lien copié.");
    } catch {
      toast.error("Copie impossible, sélectionnez le lien manuellement.");
    }
  }

  return (
    <div className="space-y-5">
      <form
        action={async (formData) => {
          const res = await creerInvitation(formData);
          if (res.ok) toast.success("Invitation créée. Copiez le lien ci-dessous.");
          else toast.error(res.message ?? "Une erreur est survenue.");
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-2">
          <Label htmlFor="inv-email">Email de l&apos;invité</Label>
          <Input id="inv-email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-nom">Nom (optionnel)</Label>
          <Input id="inv-nom" name="nom" />
        </div>
        <Button type="submit">Créer le lien</Button>
      </form>

      {invitations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Invitations en attente</p>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="shrink-0 font-medium">{inv.email}</span>
              <span className="min-w-40 flex-1 truncate text-muted-foreground">{lien(inv.token)}</span>
              <Button variant="outline" size="sm" onClick={() => copier(inv.token)}>
                Copier le lien
              </Button>
              <form
                action={async (formData) => {
                  const res = await supprimerInvitation(formData);
                  if (res.ok) toast.success("Invitation supprimée.");
                  else toast.error(res.message ?? "Une erreur est survenue.");
                }}
              >
                <input type="hidden" name="id" value={inv.id} />
                <Button type="submit" variant="outline" size="sm">
                  Supprimer
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Le lien est valable 7 jours et utilisable une seule fois. Envoyez-le à votre associé : il
        choisira lui-même son mot de passe.
      </p>
    </div>
  );
}
