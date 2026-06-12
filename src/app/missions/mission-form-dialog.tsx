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
import type { MissionCree, Resultat } from "./actions";
import { ClientFormDialog } from "@/app/clients/client-form-dialog";
import { creerClient } from "@/app/clients/actions";
import { FreelanceFormDialog } from "@/app/freelances/freelance-form-dialog";
import { creerFreelance } from "@/app/freelances/actions";
import { ajouterClientLocal, ajouterFreelanceLocal } from "@/lib/entity-options";

type OptionFreelance = { id: number; prenom: string; nom: string };
type OptionClient = { id: number; nom: string };

type Mission = {
  id: number;
  freelanceId: number;
  clientId: number;
  nom: string;
  tjmAchat: string;
  tjmVente: string;
};

export function MissionFormDialog({
  action,
  titre,
  trigger,
  freelancesActifs,
  clientsListe,
  mission,
  onCreated,
  freelanceIdInitial,
  clientIdInitial,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  titre: string;
  trigger: React.ReactElement;
  freelancesActifs: OptionFreelance[];
  clientsListe: OptionClient[];
  mission?: Mission;
  onCreated?: (mission: MissionCree) => void;
  freelanceIdInitial?: number;
  clientIdInitial?: number;
}) {
  const [open, setOpen] = useState(false);

  // Clé qui change si les valeurs de la mission changent : force le remontage du
  // formulaire (réinitialisation propre) au lieu de muter un champ déjà initialisé.
  const cleMission = mission
    ? `${mission.id}:${mission.nom}:${mission.freelanceId}:${mission.clientId}:${mission.tjmAchat}:${mission.tjmVente}`
    : `new:${freelanceIdInitial ?? ""}:${clientIdInitial ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titre}</DialogTitle>
        </DialogHeader>

        <FormulaireMission
          key={cleMission}
          action={action}
          freelancesActifs={freelancesActifs}
          clientsListe={clientsListe}
          mission={mission}
          onCreated={onCreated}
          freelanceIdInitial={freelanceIdInitial}
          clientIdInitial={clientIdInitial}
          onSucces={() => {
            toast.success("Mission enregistrée.");
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FormulaireMission({
  action,
  freelancesActifs,
  clientsListe,
  mission,
  onCreated,
  freelanceIdInitial,
  clientIdInitial,
  onSucces,
}: {
  action: (formData: FormData) => Promise<Resultat>;
  freelancesActifs: OptionFreelance[];
  clientsListe: OptionClient[];
  mission?: Mission;
  onCreated?: (mission: MissionCree) => void;
  freelanceIdInitial?: number;
  clientIdInitial?: number;
  onSucces: () => void;
}) {
  // TJM contrôlés pour pouvoir détecter une modification et proposer la propagation.
  const [tjmAchat, setTjmAchat] = useState(mission?.tjmAchat ?? "");
  const [tjmVente, setTjmVente] = useState(mission?.tjmVente ?? "");
  const [freelancesOptions, setFreelancesOptions] = useState(freelancesActifs);
  const [clientsOptions, setClientsOptions] = useState(clientsListe);
  const freelanceInitial = mission?.freelanceId ?? freelanceIdInitial;
  const clientInitial = mission?.clientId ?? clientIdInitial;
  const [freelanceId, setFreelanceId] = useState(
    freelanceInitial ? String(freelanceInitial) : ""
  );
  const [clientId, setClientId] = useState(clientInitial ? String(clientInitial) : "");

  // On ne propose la propagation qu'en modification, et seulement si un TJM a changé.
  const tjmModifie =
    !!mission &&
    (Number(tjmAchat) !== Number(mission.tjmAchat) ||
      Number(tjmVente) !== Number(mission.tjmVente));

  return (
    <form
      action={async (formData) => {
        const res = await action(formData);
        if (res.ok) {
          if (!mission && "mission" in res && res.mission) onCreated?.(res.mission);
          onSucces();
        } else {
          toast.error(res.message ?? "Une erreur est survenue.");
        }
      }}
      className="space-y-4"
    >
      {mission ? <input type="hidden" name="id" value={mission.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="nom">Nom de la mission *</Label>
        <Input id="nom" name="nom" defaultValue={mission?.nom ?? ""} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="freelanceId">Freelance *</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Select
            id="freelanceId"
            name="freelanceId"
            value={freelanceId}
            onValueChange={setFreelanceId}
            required
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tjmAchat">TJM achat (€ HT) *</Label>
          <Input
            id="tjmAchat"
            name="tjmAchat"
            type="number"
            min="0"
            step="1"
            value={tjmAchat}
            onChange={(e) => setTjmAchat(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tjmVente">TJM vente (€ HT) *</Label>
          <Input
            id="tjmVente"
            name="tjmVente"
            type="number"
            min="0"
            step="1"
            value={tjmVente}
            onChange={(e) => setTjmVente(e.target.value)}
            required
          />
        </div>
      </div>

      {/* N'apparaît qu'en modification, dès qu'un TJM est changé. */}
      {tjmModifie ? (
        <div className="space-y-1 rounded-md border border-border bg-secondary/40 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="appliquerAuxJoursPoses"
              value="true"
              className="mt-0.5"
            />
            <span>
              Appliquer ce nouveau tarif aux jours déjà posés dans le planning, à partir
              d’aujourd’hui.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Les jours passés gardent leur tarif. Sans cette option, seuls les jours posés
            ensuite utiliseront le nouveau tarif.
          </p>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="submit">Enregistrer</Button>
      </DialogFooter>
    </form>
  );
}
