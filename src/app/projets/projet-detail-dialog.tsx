"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ArchiveProjetButton } from "./archive-projet-button";
import { ChampInline } from "@/app/_drawer/champ-inline";
import { modifierChampEntite } from "@/app/_drawer/actions";
import { formatEuro, formatDate } from "@/lib/format";
import { pourcentFiabilite } from "@/lib/calculs/previsionnel";
import { STATUTS_COMMERCIAUX } from "@/lib/projets/statut-commercial";
import { FreelanceFormDialog } from "@/app/freelances/freelance-form-dialog";
import { creerFreelance } from "@/app/freelances/actions";
import { ajouterFreelanceLocal } from "@/lib/entity-options";
import {
  ajouterEncaissement,
  supprimerEncaissement,
  marquerEncaissementRealise,
  ajouterDecaissement,
  supprimerDecaissement,
  marquerDecaissementRealise,
  ajouterJalon,
  supprimerJalon,
  type Resultat,
} from "./actions";

type Encaissement = {
  id: number;
  date: string;
  montant: string;
  libelle: string | null;
  statut: string;
  fiabilite: string | null;
};
type Decaissement = Encaissement & { freelanceNom: string };
type Jalon = { id: number; date: string; libelle: string };
type OptionFreelance = { id: number; prenom: string; nom: string };


export function ProjetDetailDialog({
  projet,
  encaissements,
  decaissements,
  jalons,
  freelancesActifs,
  open,
  onOpenChange,
}: {
  projet: {
    id: number;
    nom: string;
    clientId: number;
    clientNom: string;
    budget: string;
    statutCommercial: string;
    montantEnvisage: string | null;
    fiabiliteDefaut: string | null;
    clientFiabilite: string | null;
    actif: boolean;
  };
  encaissements: Encaissement[];
  decaissements: Decaissement[];
  jalons: Jalon[];
  freelancesActifs: OptionFreelance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [freelancesOptions, setFreelancesOptions] = useState(freelancesActifs);
  const [freelanceDecaissementId, setFreelanceDecaissementId] = useState("");

  async function sauverChamp(cle: string, valeur: string) {
    const res = await modifierChampEntite({ type: "projet", id: projet.id }, cle, valeur);
    if (res.ok) {
      toast.success("Projet modifié.");
      router.refresh();
    } else {
      toast.error(res.message ?? "Modification impossible.");
    }
  }

  const estPrevu = (x: { statut: string }) => x.statut === "prevu";
  const somme = (arr: { montant: string }[]) => arr.reduce((s, x) => s + Number(x.montant), 0);

  const totalEncReel = somme(encaissements.filter((e) => !estPrevu(e)));
  const totalEncPrevu = somme(encaissements.filter(estPrevu));
  const totalDecReel = somme(decaissements.filter((d) => !estPrevu(d)));
  const margeReelle = totalEncReel - totalDecReel;
  const resteAPlanifier = Number(projet.budget) - (totalEncReel + totalEncPrevu);

  async function gerer(res: Resultat, succes: string) {
    if (res.ok) toast.success(succes);
    else toast.error(res.message ?? "Une erreur est survenue.");
  }

  // Échéancier : du plus ancien au plus récent (lecture chronologique).
  const triAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));

  async function action(id: number, fn: (fd: FormData) => Promise<Resultat>, succes: string) {
    const fd = new FormData();
    fd.set("id", String(id));
    gerer(await fn(fd), succes);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-2xl">
        <SheetHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Projet</p>
          <SheetTitle>
            {projet.nom} <span className="text-muted-foreground">· {projet.clientNom}</span>
          </SheetTitle>
        </SheetHeader>

        {/* Nom et budget : éditables au clic (le client n'est pas modifiable ici) */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
          <ChampInline
            label="Nom du projet"
            valeur={projet.nom}
            onSave={(v) => sauverChamp("nom", v)}
          />
          <ChampInline
            label="Budget (€)"
            valeur={String(Math.round(Number(projet.budget)))}
            type="number"
            onSave={(v) => sauverChamp("budget", v)}
          />
          <div className="space-y-1">
            <Label htmlFor={`projet-statut-${projet.id}`}>Statut commercial</Label>
            <Select
              id={`projet-statut-${projet.id}`}
              defaultValue={projet.statutCommercial}
              options={STATUTS_COMMERCIAUX.map((s) => ({ value: s.key, label: s.label }))}
              onValueChange={(v) => void sauverChamp("statutCommercial", v)}
            />
          </div>
          <ChampInline
            label="Montant envisagé (€)"
            valeur={
              projet.montantEnvisage ? String(Math.round(Number(projet.montantEnvisage))) : ""
            }
            type="number"
            onSave={(v) => sauverChamp("montantEnvisage", v)}
          />
        </div>

        {/* Récap (réalisé, sauf "reste à planifier" qui tient compte du prévu) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Recap titre="Budget" valeur={formatEuro(Number(projet.budget))} />
          <Recap titre="Encaissé" valeur={formatEuro(totalEncReel)} />
          <Recap titre="Décaissé" valeur={formatEuro(totalDecReel)} />
          <Recap titre="Marge réalisée" valeur={formatEuro(margeReelle)} accent={margeReelle < 0} />
          <Recap titre="Reste à planifier" valeur={formatEuro(resteAPlanifier)} />
        </div>

        <div className="space-y-6">
          {/* Recettes (client) */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-emerald-600">
              Recettes (client)
              {totalEncPrevu > 0 ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {formatEuro(totalEncPrevu)} prévu
                </span>
              ) : null}
            </p>
            <div className="space-y-1">
              {encaissements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune recette.</p>
              ) : (
                triAsc(encaissements).map((e) => (
                  <LigneEcheance
                    key={e.id}
                    date={e.date}
                    libelle={e.libelle ?? ""}
                    montant={e.montant}
                    prevu={estPrevu(e)}
                    info={estPrevu(e) ? `Fiabilité ${pourcentFiabilite(e.fiabilite)} %` : null}
                    onMarquerPaye={
                      estPrevu(e)
                        ? () => action(e.id, marquerEncaissementRealise, "Recette encaissée.")
                        : null
                    }
                    onSupprimer={() => action(e.id, supprimerEncaissement, "Recette supprimée.")}
                  />
                ))
              )}
            </div>
            <form
              action={async (fd) => gerer(await ajouterEncaissement(fd), "Recette ajoutée.")}
              className="space-y-2 border-t border-border pt-3"
            >
              <input type="hidden" name="projetId" value={projet.id} />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`enc-date-${projet.id}`}>Date *</Label>
                  <Input id={`enc-date-${projet.id}`} name="date" type="date" defaultValue={aujourdhui} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`enc-montant-${projet.id}`}>Montant (€) *</Label>
                  <Input id={`enc-montant-${projet.id}`} name="montant" type="number" min="0" step="1" required />
                </div>
              </div>
              <Input name="libelle" placeholder="Libellé (optionnel)" />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`enc-statut-${projet.id}`}>Statut</Label>
                  <Select
                    id={`enc-statut-${projet.id}`}
                    name="statut"
                    defaultValue="prevu"
                    options={[
                      { value: "prevu", label: "Prévu (à venir)" },
                      { value: "encaisse", label: "Encaissé (déjà reçu)" },
                    ]}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`enc-fiab-${projet.id}`}>Fiabilité % (si prévu)</Label>
                  <Input
                    id={`enc-fiab-${projet.id}`}
                    name="fiabilite"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue="100"
                    placeholder="0 à 100"
                  />
                </div>
              </div>
              <Button type="submit" size="sm" variant="outline">
                Ajouter une recette
              </Button>
            </form>
          </div>

          {/* Coûts (freelances) */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-rose-600">Coûts (freelances)</p>
            <div className="space-y-1">
              {decaissements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun coût.</p>
              ) : (
                triAsc(decaissements).map((d) => (
                  <LigneEcheance
                    key={d.id}
                    date={d.date}
                    libelle={`${d.freelanceNom}${d.libelle ? ` · ${d.libelle}` : ""}`}
                    montant={d.montant}
                    prevu={estPrevu(d)}
                    info={null}
                    onMarquerPaye={
                      estPrevu(d)
                        ? () => action(d.id, marquerDecaissementRealise, "Coût décaissé.")
                        : null
                    }
                    onSupprimer={() => action(d.id, supprimerDecaissement, "Coût supprimé.")}
                  />
                ))
              )}
            </div>
            <form
              action={async (fd) => gerer(await ajouterDecaissement(fd), "Coût ajouté.")}
              className="space-y-2 border-t border-border pt-3"
            >
              <input type="hidden" name="projetId" value={projet.id} />
              <div className="space-y-1">
                <Label htmlFor={`dec-freelance-${projet.id}`}>Freelance *</Label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Select
                    id={`dec-freelance-${projet.id}`}
                    name="freelanceId"
                    required
                    value={freelanceDecaissementId}
                    onValueChange={setFreelanceDecaissementId}
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
                      setFreelanceDecaissementId(resultat.selectedId);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`dec-date-${projet.id}`}>Date *</Label>
                  <Input id={`dec-date-${projet.id}`} name="date" type="date" defaultValue={aujourdhui} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`dec-montant-${projet.id}`}>Montant (€) *</Label>
                  <Input id={`dec-montant-${projet.id}`} name="montant" type="number" min="0" step="1" required />
                </div>
              </div>
              <Input name="libelle" placeholder="Libellé (optionnel)" />
              <div className="space-y-1">
                <Label htmlFor={`dec-statut-${projet.id}`}>Statut</Label>
                <Select
                  id={`dec-statut-${projet.id}`}
                  name="statut"
                  defaultValue="prevu"
                  options={[
                    { value: "prevu", label: "Prévu (à venir)" },
                    { value: "decaisse", label: "Décaissé (déjà versé)" },
                  ]}
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                Ajouter un coût
              </Button>
            </form>
          </div>
        </div>

        {/* Jalons : repères datés, sans montant (n'impactent pas la marge) */}
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-amber-600">Jalons (étapes clés)</p>
          <div className="space-y-1">
            {jalons.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun jalon.</p>
            ) : (
              triAsc(jalons).map((j) => (
                <LigneEcheance
                  key={j.id}
                  date={j.date}
                  libelle={j.libelle}
                  montant={null}
                  prevu={false}
                  info={null}
                  onMarquerPaye={null}
                  onSupprimer={() => action(j.id, supprimerJalon, "Jalon supprimé.")}
                />
              ))
            )}
          </div>
          <form
            action={async (fd) => gerer(await ajouterJalon(fd), "Jalon ajouté.")}
            className="space-y-2 border-t border-border pt-3"
          >
            <input type="hidden" name="projetId" value={projet.id} />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`jal-date-${projet.id}`}>Date *</Label>
                <Input id={`jal-date-${projet.id}`} name="date" type="date" defaultValue={aujourdhui} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`jal-libelle-${projet.id}`}>Libellé *</Label>
                <Input id={`jal-libelle-${projet.id}`} name="libelle" placeholder="Ex : Livraison V1" required />
              </div>
            </div>
            <Button type="submit" size="sm" variant="outline">
              Ajouter un jalon
            </Button>
          </form>
        </div>

        <SheetFooter>
          <ArchiveProjetButton id={projet.id} actif={projet.actif} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Recap({ titre, valeur, accent }: { titre: string; valeur: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{titre}</p>
      <p className={`text-lg font-medium ${accent ? "text-rose-600" : ""}`}>{valeur}</p>
    </div>
  );
}

// Une ligne d'échéancier : date, libellé, éventuelle info (fiabilité), montant,
// bouton "marquer payé" (si prévu) et suppression.
function LigneEcheance({
  date,
  libelle,
  montant,
  prevu,
  info,
  onMarquerPaye,
  onSupprimer,
}: {
  date: string;
  libelle: string;
  montant: string | null;
  prevu: boolean;
  info: string | null;
  onMarquerPaye: (() => void | Promise<void>) | null;
  onSupprimer: () => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
      {prevu ? (
        <span className="shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
          Prévu
        </span>
      ) : null}
      <span className="shrink-0 font-medium">{formatDate(date)}</span>
      <span className="flex-1 truncate text-muted-foreground">
        {libelle}
        {info ? <span className="ml-1 text-amber-700">· {info}</span> : null}
      </span>
      {montant !== null ? (
        <span className="shrink-0 tabular-nums">{formatEuro(Number(montant))}</span>
      ) : null}
      {onMarquerPaye ? (
        <button
          onClick={onMarquerPaye}
          className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-secondary"
          title="Marquer comme payé"
        >
          ✓ payé
        </button>
      ) : null}
      <button
        onClick={onSupprimer}
        className="shrink-0 text-muted-foreground hover:text-rose-600"
        aria-label="Supprimer"
        title="Supprimer"
      >
        ×
      </button>
    </div>
  );
}
