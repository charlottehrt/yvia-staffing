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
import { Select } from "@/components/ui/select";
import { STATUTS_COMMERCIAUX } from "@/lib/projets/statut-commercial";
import type { Resultat } from "./actions";
import { ClientFormDialog } from "@/app/clients/client-form-dialog";
import { creerClient } from "@/app/clients/actions";
import { ajouterClientLocal } from "@/lib/entity-options";

type OptionClient = { id: number; nom: string };

type Projet = {
  id: number;
  clientId: number;
  nom: string;
  budget: string;
  statutCommercial: string;
};

export function ProjetFormDialog({
  action,
  titre,
  trigger,
  clientsListe,
  projet,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  titre: string;
  trigger: React.ReactElement;
  clientsListe: OptionClient[];
  projet?: Projet;
}) {
  const [open, setOpen] = useState(false);
  const [clientsOptions, setClientsOptions] = useState(clientsListe);
  const [clientId, setClientId] = useState(projet?.clientId ? String(projet.clientId) : "");

  const cle = projet
    ? `${projet.id}:${projet.nom}:${projet.budget}:${projet.clientId}:${projet.statutCommercial}`
    : "new";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>

        <form
          key={cle}
          action={async (formData) => {
            const res = await action(formData);
            if (res.ok) {
              toast.success("Projet enregistré.");
              setOpen(false);
            } else {
              toast.error(res.message ?? "Une erreur est survenue.");
            }
          }}
          className="space-y-4"
        >
          {projet ? <input type="hidden" name="id" value={projet.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="nom">Nom du projet *</Label>
            <Input id="nom" name="nom" defaultValue={projet?.nom ?? ""} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientId">Client *</Label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Select
                id="clientId"
                name="clientId"
                value={clientId}
                onValueChange={setClientId}
                required
                placeholder="Choisir un client"
                options={clientsOptions.map((c) => ({ value: c.id, label: c.nom }))}
              />
              <ClientFormDialog
                action={creerClient}
                titre="Nouveau client"
                trigger={
                  <Button type="button" variant="outline">
                    Créer
                  </Button>
                }
                onCreated={(client) => {
                  const resultat = ajouterClientLocal(clientsOptions, client);
                  setClientsOptions(resultat.options);
                  setClientId(resultat.selectedId);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget (enveloppe, € HT) *</Label>
            <Input
              id="budget"
              name="budget"
              type="number"
              min="0"
              step="1"
              defaultValue={projet?.budget ?? ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="statutCommercial">Statut commercial</Label>
            <Select
              id="statutCommercial"
              name="statutCommercial"
              defaultValue={projet?.statutCommercial ?? "a_qualifier"}
              options={STATUTS_COMMERCIAUX.map((s) => ({ value: s.key, label: s.label }))}
            />
          </div>

          <DialogFooter>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
