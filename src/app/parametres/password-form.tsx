"use client";

import { toast } from "sonner";
import { ApresHydratation, ChampFactice } from "@/components/apres-hydratation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changerMotDePasse } from "./actions";

export function PasswordForm() {
  return (
    <ApresHydratation fallback={<SquelettePassword />}>
      <form
        action={async (formData) => {
          const res = await changerMotDePasse(formData);
          if (res.ok) toast.success("Mot de passe modifié.");
          else toast.error(res.message ?? "Une erreur est survenue.");
        }}
        className="max-w-sm space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="actuel">Mot de passe actuel</Label>
          <Input id="actuel" name="actuel" type="password" autoComplete="current-password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nouveau">Nouveau mot de passe</Label>
          <Input id="nouveau" name="nouveau" type="password" autoComplete="new-password" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">Confirmer le nouveau mot de passe</Label>
          <Input
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <Button type="submit">Mettre à jour</Button>
      </form>
    </ApresHydratation>
  );
}

function SquelettePassword() {
  return (
    <div aria-hidden className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label>Mot de passe actuel</Label>
        <ChampFactice />
      </div>
      <div className="space-y-2">
        <Label>Nouveau mot de passe</Label>
        <ChampFactice />
      </div>
      <div className="space-y-2">
        <Label>Confirmer le nouveau mot de passe</Label>
        <ChampFactice />
      </div>
      <Button disabled>Mettre à jour</Button>
    </div>
  );
}
