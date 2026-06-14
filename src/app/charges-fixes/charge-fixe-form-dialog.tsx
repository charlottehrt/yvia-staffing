"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Resultat } from "./actions";

export type ChargeFixeEditable = {
  id: number;
  libelle: string;
  montantMensuel: string;
  dateDebut: string; // "AAAA-MM-JJ"
  dateFin: string | null; // "AAAA-MM-JJ" | null
};

export function ChargeFixeFormDialog({
  action,
  titre,
  trigger,
  charge,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  titre: string;
  trigger: React.ReactElement;
  charge?: ChargeFixeEditable;
}) {
  const [open, setOpen] = useState(false);

  // Clé qui force la réinitialisation propre du formulaire quand la charge change.
  const cle = charge
    ? `${charge.id}:${charge.libelle}:${charge.montantMensuel}:${charge.dateDebut}:${charge.dateFin}`
    : "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
          <DialogDescription>
            Le montant mensuel s’applique automatiquement à chaque mois. Dans la grille,
            saisissez une valeur sur un mois précis pour l’ajuster ponctuellement.
          </DialogDescription>
        </DialogHeader>

        <FormulaireCharge
          key={cle}
          action={action}
          charge={charge}
          onSucces={() => {
            toast.success("Charge fixe enregistrée.");
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormulaireCharge({
  action,
  charge,
  onSucces,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  charge?: ChargeFixeEditable;
  onSucces: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        const res = await action(formData);
        if (res.ok) onSucces();
        else toast.error(res.message ?? "Une erreur est survenue.");
      }}
      className="space-y-4"
    >
      {charge ? <input type="hidden" name="id" value={charge.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="libelle">Libellé *</Label>
        <Input
          id="libelle"
          name="libelle"
          placeholder="Ex : Notion, Figma, Loyer…"
          defaultValue={charge?.libelle ?? ""}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="montantMensuel">Montant mensuel (€) *</Label>
        <Input
          id="montantMensuel"
          name="montantMensuel"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="49"
          defaultValue={charge?.montantMensuel ?? ""}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateDebut">Mois de début *</Label>
          <Input
            id="dateDebut"
            name="dateDebut"
            type="month"
            defaultValue={charge?.dateDebut?.slice(0, 7) ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateFin">Mois de fin</Label>
          <Input
            id="dateFin"
            name="dateFin"
            type="month"
            defaultValue={charge?.dateFin?.slice(0, 7) ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            À renseigner si l’abonnement est résilié.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}
