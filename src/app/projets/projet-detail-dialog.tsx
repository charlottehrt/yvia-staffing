"use client";

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ArchiveProjetButton } from "./archive-projet-button";
import { ChampInline } from "@/app/_drawer/champ-inline";
import { modifierChampEntite } from "@/app/_drawer/actions";
import { formatEuro, formatDate } from "@/lib/format";
import { pourcentFiabilite } from "@/lib/calculs/previsionnel";
import { STATUTS_COMMERCIAUX } from "@/lib/projets/statut-commercial";
import {
  fusionnerEvenements,
  type EvenementProjet,
  type TypeEvenement,
} from "@/lib/projets/evenements";
import { EvenementFormDialog } from "./evenement-form-dialog";
import {
  supprimerEncaissement,
  marquerEncaissementRealise,
  supprimerDecaissement,
  marquerDecaissementRealise,
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

// Server Actions correspondant à chaque type d'événement de la liste unifiée.
const SUPPRESSIONS: Record<
  TypeEvenement,
  { fn: (fd: FormData) => Promise<Resultat>; succes: string }
> = {
  recette: { fn: supprimerEncaissement, succes: "Recette supprimée." },
  cout: { fn: supprimerDecaissement, succes: "Coût supprimé." },
  jalon: { fn: supprimerJalon, succes: "Jalon supprimé." },
};
const REALISATIONS: Record<
  Exclude<TypeEvenement, "jalon">,
  { fn: (fd: FormData) => Promise<Resultat>; succes: string }
> = {
  recette: { fn: marquerEncaissementRealise, succes: "Recette encaissée." },
  cout: { fn: marquerDecaissementRealise, succes: "Coût décaissé." },
};

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

  // Liste unique : recettes, coûts et jalons en ordre chronologique.
  const evenements = fusionnerEvenements(encaissements, decaissements, jalons);

  async function gerer(res: Resultat, succes: string) {
    if (res.ok) toast.success(succes);
    else toast.error(res.message ?? "Une erreur est survenue.");
  }

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
          <div className="col-span-2 space-y-1">
            <Label htmlFor={`projet-statut-${projet.id}`}>Statut commercial</Label>
            <Select
              id={`projet-statut-${projet.id}`}
              defaultValue={projet.statutCommercial}
              options={STATUTS_COMMERCIAUX.map((s) => ({ value: s.key, label: s.label }))}
              onValueChange={(v) => void sauverChamp("statutCommercial", v)}
            />
          </div>
        </div>

        {/* Récap (réalisé, sauf "reste à planifier" qui tient compte du prévu) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Recap titre="Budget" valeur={formatEuro(Number(projet.budget))} />
          <Recap titre="Encaissé" valeur={formatEuro(totalEncReel)} />
          <Recap titre="Décaissé" valeur={formatEuro(totalDecReel)} />
          <Recap titre="Marge réalisée" valeur={formatEuro(margeReelle)} accent={margeReelle < 0} />
          <Recap titre="Reste à planifier" valeur={formatEuro(resteAPlanifier)} />
        </div>

        {/* Événements : recettes, coûts et jalons en une liste chronologique unique */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Événements
              {totalEncPrevu > 0 ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {formatEuro(totalEncPrevu)} de recettes prévues
                </span>
              ) : null}
            </p>
            <EvenementFormDialog projetId={projet.id} freelancesActifs={freelancesActifs} />
          </div>
          <div className="space-y-1">
            {evenements.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun événement. Ajoutez une recette, un coût ou un jalon.
              </p>
            ) : (
              evenements.map((ev) => {
                const realisation = ev.type !== "jalon" && ev.prevu ? REALISATIONS[ev.type] : null;
                return (
                  <LigneEvenement
                    key={ev.cle}
                    evenement={ev}
                    onMarquerPaye={
                      realisation
                        ? () => action(ev.id, realisation.fn, realisation.succes)
                        : null
                    }
                    onSupprimer={() =>
                      action(ev.id, SUPPRESSIONS[ev.type].fn, SUPPRESSIONS[ev.type].succes)
                    }
                  />
                );
              })
            )}
          </div>
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

// Apparence de chaque type d'événement dans la liste unifiée.
const STYLES_EVENEMENT: Record<
  TypeEvenement,
  { label: string; badge: string; montant: string; signe: string }
> = {
  recette: {
    label: "Recette",
    badge: "bg-emerald-100 text-emerald-700",
    montant: "text-emerald-700",
    signe: "+",
  },
  cout: {
    label: "Coût",
    badge: "bg-rose-100 text-rose-700",
    montant: "text-rose-700",
    signe: "−",
  },
  jalon: { label: "Jalon", badge: "bg-sky-100 text-sky-700", montant: "", signe: "" },
};

// Une ligne d'événement : date, badge de type, badge « Prévu » le cas échéant,
// libellé (et fiabilité d'une recette prévue), montant signé, actions.
function LigneEvenement({
  evenement,
  onMarquerPaye,
  onSupprimer,
}: {
  evenement: EvenementProjet;
  onMarquerPaye: (() => void | Promise<void>) | null;
  onSupprimer: () => void | Promise<void>;
}) {
  const style = STYLES_EVENEMENT[evenement.type];
  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
      <span className="shrink-0 font-medium tabular-nums">{formatDate(evenement.date)}</span>
      <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium ${style.badge}`}>
        {style.label}
      </span>
      {evenement.prevu ? (
        <span className="shrink-0 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
          Prévu
        </span>
      ) : null}
      <span className="flex-1 truncate text-muted-foreground">
        {evenement.libelle}
        {evenement.type === "recette" && evenement.prevu ? (
          <span className="ml-1 text-amber-700">
            · Fiabilité {pourcentFiabilite(evenement.fiabilite)} %
          </span>
        ) : null}
      </span>
      {evenement.montant !== null ? (
        <span className={`shrink-0 tabular-nums ${style.montant}`}>
          {style.signe}
          {formatEuro(Number(evenement.montant))}
        </span>
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
