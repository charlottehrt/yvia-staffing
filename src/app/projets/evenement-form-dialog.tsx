"use client";
// Popup d'ajout d'un événement de projet : recette, coût ou jalon. Le type
// choisi adapte les champs affichés et la Server Action appelée.

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
import { FreelanceFormDialog } from "@/app/freelances/freelance-form-dialog";
import { creerFreelance } from "@/app/freelances/actions";
import { ajouterFreelanceLocal } from "@/lib/entity-options";
import type { TypeEvenement } from "@/lib/projets/evenements";
import { ajouterEncaissement, ajouterDecaissement, ajouterJalon, type Resultat } from "./actions";

type OptionFreelance = { id: number; prenom: string; nom: string };

const TYPES: { value: TypeEvenement; label: string; aide: string }[] = [
  { value: "recette", label: "Recette", aide: "Argent reçu (ou attendu) du client." },
  { value: "cout", label: "Coût", aide: "Montant versé (ou à verser) à un freelance." },
  { value: "jalon", label: "Jalon", aide: "Étape clé datée, sans impact financier." },
];

const AJOUTS: Record<
  TypeEvenement,
  { action: (fd: FormData) => Promise<Resultat>; succes: string }
> = {
  recette: { action: ajouterEncaissement, succes: "Recette ajoutée." },
  cout: { action: ajouterDecaissement, succes: "Coût ajouté." },
  jalon: { action: ajouterJalon, succes: "Jalon ajouté." },
};

export function EvenementFormDialog({
  projetId,
  freelancesActifs,
}: {
  projetId: number;
  freelancesActifs: OptionFreelance[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TypeEvenement>("recette");
  // "realise" : tout sauf "prevu" est traité comme réalisé par les Server Actions.
  const [statut, setStatut] = useState("prevu");
  const [freelancesOptions, setFreelancesOptions] = useState(freelancesActifs);
  const [freelanceId, setFreelanceId] = useState("");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const aide = TYPES.find((t) => t.value === type)?.aide;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm">
            Ajouter un événement
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un événement</DialogTitle>
        </DialogHeader>

        <form
          action={async (formData) => {
            const { action, succes } = AJOUTS[type];
            const res = await action(formData);
            if (res.ok) {
              toast.success(succes);
              setOpen(false);
            } else {
              toast.error(res.message ?? "Une erreur est survenue.");
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="projetId" value={projetId} />

          <div className="space-y-2">
            <Label>Type d&apos;événement</Label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  size="sm"
                  variant={type === t.value ? "default" : "outline"}
                  aria-pressed={type === t.value}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{aide}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`evt-date-${projetId}`}>Date *</Label>
            <Input
              id={`evt-date-${projetId}`}
              name="date"
              type="date"
              defaultValue={aujourdhui}
              required
            />
          </div>

          {type === "cout" ? (
            <div className="space-y-2">
              <Label htmlFor={`evt-freelance-${projetId}`}>Freelance *</Label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Select
                  id={`evt-freelance-${projetId}`}
                  name="freelanceId"
                  required
                  value={freelanceId}
                  onValueChange={setFreelanceId}
                  placeholder="Choisir un freelance"
                  options={freelancesOptions.map((f) => ({
                    value: f.id,
                    label: `${f.prenom} ${f.nom}`,
                  }))}
                />
                <FreelanceFormDialog
                  action={creerFreelance}
                  titre="Nouveau freelance"
                  trigger={
                    <Button type="button" variant="outline">
                      Créer
                    </Button>
                  }
                  onCreated={(freelance) => {
                    const resultat = ajouterFreelanceLocal(freelancesOptions, freelance);
                    setFreelancesOptions(resultat.options);
                    setFreelanceId(resultat.selectedId);
                  }}
                />
              </div>
            </div>
          ) : null}

          {type !== "jalon" ? (
            <div className="space-y-2">
              <Label htmlFor={`evt-montant-${projetId}`}>Montant (€) *</Label>
              <Input
                id={`evt-montant-${projetId}`}
                name="montant"
                type="number"
                min="0"
                step="1"
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`evt-libelle-${projetId}`}>
              {type === "jalon" ? "Libellé *" : "Libellé"}
            </Label>
            <Input
              id={`evt-libelle-${projetId}`}
              name="libelle"
              placeholder={type === "jalon" ? "Ex : Livraison V1" : "Optionnel"}
              required={type === "jalon"}
            />
          </div>

          {type !== "jalon" ? (
            <div className="space-y-2">
              <Label htmlFor={`evt-statut-${projetId}`}>Statut</Label>
              <Select
                id={`evt-statut-${projetId}`}
                name="statut"
                value={statut}
                onValueChange={setStatut}
                options={[
                  { value: "prevu", label: "Prévu (à venir)" },
                  {
                    value: "realise",
                    label: type === "recette" ? "Encaissé (déjà reçu)" : "Décaissé (déjà versé)",
                  },
                ]}
              />
            </div>
          ) : null}

          {type === "recette" && statut === "prevu" ? (
            <div className="space-y-2">
              <Label htmlFor={`evt-fiabilite-${projetId}`}>Fiabilité (%)</Label>
              <Input
                id={`evt-fiabilite-${projetId}`}
                name="fiabilite"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue="100"
              />
              <p className="text-xs text-muted-foreground">
                Probabilité d&apos;encaisser cette recette (pondère le prévisionnel).
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit">Ajouter</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
