"use client";
// Pile de drawers en cascade. `EntityLink` ouvre (ou empile) le détail d'une
// entité ; le drawer affiche le sommet de la pile avec un bouton « retour » pour
// revenir au niveau précédent. Un seul panneau à l'écran, navigation infinie.

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { chargerEntite, basculerActif, modifierChampEntite } from "./actions";
import { ChampInline } from "./champ-inline";
import { LIBELLE_TYPE, type DetailEntite, type EntiteRef, type Lien } from "./types";

type DrawerContexte = {
  ouvrir: (ref: EntiteRef) => void;
};

const Contexte = React.createContext<DrawerContexte | null>(null);

export function useDrawer() {
  const ctx = React.useContext(Contexte);
  if (!ctx) throw new Error("useDrawer doit être utilisé dans <DrawerProvider>");
  return ctx;
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [pile, setPile] = React.useState<EntiteRef[]>([]);

  const ouvrir = React.useCallback((ref: EntiteRef) => {
    setPile((p) => [...p, ref]);
  }, []);
  const retour = React.useCallback(() => setPile((p) => p.slice(0, -1)), []);
  const fermer = React.useCallback(() => setPile([]), []);

  const sommet = pile[pile.length - 1] ?? null;

  return (
    <Contexte.Provider value={{ ouvrir }}>
      {children}
      <Sheet open={pile.length > 0} onOpenChange={(o) => !o && fermer()}>
        {sommet ? (
          <DrawerContenu
            key={`${sommet.type}-${sommet.id}`}
            entite={sommet}
            peutRevenir={pile.length > 1}
            onRetour={retour}
            onOuvrir={ouvrir}
          />
        ) : null}
      </Sheet>
    </Contexte.Provider>
  );
}

function DrawerContenu({
  entite,
  peutRevenir,
  onRetour,
  onOuvrir,
}: {
  entite: EntiteRef;
  peutRevenir: boolean;
  onRetour: () => void;
  onOuvrir: (ref: EntiteRef) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<DetailEntite | null>(null);
  const [chargement, setChargement] = React.useState(true);
  const [enCours, setEnCours] = React.useState(false);
  // Incrémenté pour forcer un rechargement (après une bascule actif/inactif).
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let actif = true;
    chargerEntite(entite).then((d) => {
      if (!actif) return;
      setDetail(d);
      setChargement(false);
    });
    return () => {
      actif = false;
    };
  }, [entite, nonce]);

  async function basculer() {
    setEnCours(true);
    await basculerActif(entite);
    setEnCours(false);
    setNonce((n) => n + 1);
    router.refresh();
  }

  async function sauverChamp(cle: string, valeur: string) {
    const res = await modifierChampEntite(entite, cle, valeur);
    if (res.ok) {
      toast.success("Modification enregistrée.");
      setNonce((n) => n + 1);
      router.refresh();
    } else {
      toast.error(res.message ?? "Modification impossible.");
      setNonce((n) => n + 1); // recharge la valeur d'origine
    }
  }

  return (
    <SheetContent>
      <SheetHeader>
        {peutRevenir ? (
          <button
            onClick={onRetour}
            className="-ml-1 flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Retour
          </button>
        ) : null}
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {LIBELLE_TYPE[entite.type]}
        </p>
        <SheetTitle>{detail?.titre ?? "Chargement…"}</SheetTitle>
        {detail?.sousTitre ? (
          <p className="text-sm text-muted-foreground">{detail.sousTitre}</p>
        ) : null}
      </SheetHeader>

      {chargement && !detail ? (
        <p className="text-sm text-muted-foreground">Chargement du détail…</p>
      ) : !detail ? (
        <p className="text-sm text-muted-foreground">Entité introuvable.</p>
      ) : (
        <div className="space-y-5">
          {/* Champs éditables au clic */}
          {detail.champs.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
              {detail.champs.map((champ) => (
                <ChampInline
                  key={champ.cle}
                  label={champ.label}
                  valeur={champ.valeur}
                  type={champ.type}
                  onSave={(v) => sauverChamp(champ.cle, v)}
                />
              ))}
            </div>
          ) : null}

          {detail.infos.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {detail.infos.map((info) => (
                <div key={info.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                  <p className="font-display text-lg">{info.valeur}</p>
                </div>
              ))}
            </div>
          ) : null}

          {detail.sections.map((section) => (
            <div key={section.titre} className="space-y-2">
              <p className="text-sm font-medium">{section.titre}</p>
              {section.liens.length === 0 ? (
                <p className="text-sm text-muted-foreground">{section.vide}</p>
              ) : (
                <div className="divide-y rounded-lg border border-border">
                  {section.liens.map((lien) => (
                    <LienEntiteButton
                      key={`${lien.ref.type}-${lien.ref.id}`}
                      lien={lien}
                      onOuvrir={onOuvrir}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {detail && entite.type !== "user" ? (
        <SheetFooter>
          <Button
            variant={detail.actif ? "outline" : "default"}
            onClick={basculer}
            disabled={enCours}
          >
            <Power className="size-4" />
            {detail.actif ? detail.actionLabel : entite.type === "projet" ? "Réouvrir" : "Réactiver"}
          </Button>
        </SheetFooter>
      ) : null}
    </SheetContent>
  );
}

export function LienEntiteButton({
  lien,
  onOuvrir,
}: {
  lien: Lien;
  onOuvrir: (ref: EntiteRef) => void;
}) {
  const estInactif = lien.statut?.actif === false;

  if (!lien.statut) {
    return (
      <button
        onClick={() => onOuvrir(lien.ref)}
        className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
      >
        <span className="font-medium text-primary group-hover:underline">{lien.label}</span>
        {lien.sous ? (
          <span className="text-xs text-muted-foreground">{lien.sous}</span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      onClick={() => onOuvrir(lien.ref)}
      className={cn(
        "group flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted",
        estInactif && "bg-muted/40 text-muted-foreground"
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-medium text-primary group-hover:underline",
            estInactif && "text-muted-foreground"
          )}
        >
          {lien.label}
        </span>
        {lien.sous ? (
          <span className="block truncate text-xs text-muted-foreground">{lien.sous}</span>
        ) : null}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
          lien.statut.actif
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-border bg-muted text-muted-foreground"
        )}
      >
        {lien.statut.label}
      </span>
    </button>
  );
}

// Élément cliquable qui ouvre (ou empile) le détail d'une entité.
export function EntityLink({
  type,
  id,
  children,
  className,
}: {
  type: EntiteRef["type"];
  id: number;
  children: React.ReactNode;
  className?: string;
}) {
  const { ouvrir } = useDrawer();
  return (
    <button
      type="button"
      onClick={() => ouvrir({ type, id })}
      className={
        className ?? "text-left font-medium hover:text-primary hover:underline"
      }
    >
      {children}
    </button>
  );
}
