"use client";
// Panneau latéral d'une tâche : son fil de commentaires de suivi (le plus récent
// en haut), un champ pour en ajouter, et les actions (renommer / terminer / supprimer).
// Contrôlé par la ligne parente ; après chaque mutation on rafraîchit les données
// serveur (router.refresh) sans fermer le panneau.

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
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TacheFormDialog } from "./tache-form-dialog";
import { formatDateHeure } from "@/lib/format";
import {
  renommerTache,
  basculerTermineTache,
  supprimerTache,
  ajouterCommentaire,
  supprimerCommentaire,
  type Resultat,
} from "./actions";

export type Commentaire = {
  id: number;
  contenu: string;
  creeLe: string;
};

export type TacheDetail = {
  id: number;
  nom: string;
  termine: boolean;
  creeLe: string;
};

export function TacheDetailSheet({
  tache,
  commentaires,
  open,
  onOpenChange,
}: {
  tache: TacheDetail;
  commentaires: Commentaire[]; // déjà triés du plus récent au plus ancien
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [contenu, setContenu] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function gerer(res: Resultat, succes: string): Promise<boolean> {
    if (res.ok) {
      toast.success(succes);
      router.refresh();
      return true;
    }
    toast.error(res.message ?? "Une erreur est survenue.");
    return false;
  }

  async function envoyerCommentaire() {
    const texte = contenu.trim();
    if (!texte || envoiEnCours) return;
    setEnvoiEnCours(true);
    const fd = new FormData();
    fd.set("tacheId", String(tache.id));
    fd.set("contenu", texte);
    const ok = await gerer(await ajouterCommentaire(fd), "Commentaire ajouté.");
    if (ok) setContenu("");
    setEnvoiEnCours(false);
  }

  async function actionSurId(
    id: number,
    fn: (fd: FormData) => Promise<Resultat>,
    succes: string,
  ) {
    const fd = new FormData();
    fd.set("id", String(id));
    await gerer(await fn(fd), succes);
  }

  async function basculerTermine() {
    const fd = new FormData();
    fd.set("id", String(tache.id));
    fd.set("termine", String(tache.termine));
    await gerer(
      await basculerTermineTache(fd),
      tache.termine ? "Tâche rouverte." : "Tâche terminée.",
    );
  }

  async function supprimer() {
    const fd = new FormData();
    fd.set("id", String(tache.id));
    const ok = await gerer(await supprimerTache(fd), "Tâche supprimée.");
    if (ok) onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tâche
          </p>
          <SheetTitle className={tache.termine ? "text-muted-foreground line-through" : ""}>
            {tache.nom}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Créée le {formatDateHeure(tache.creeLe)}
            {tache.termine ? " · terminée" : ""}
          </p>
        </SheetHeader>

        {/* Ajout d'un point de suivi */}
        <div className="space-y-2">
          <Textarea
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Ajouter un point d'avancement…"
            rows={3}
            onKeyDown={(e) => {
              // Cmd/Ctrl + Entrée pour envoyer rapidement.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void envoyerCommentaire();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => void envoyerCommentaire()}
              disabled={!contenu.trim() || envoiEnCours}
            >
              Ajouter le suivi
            </Button>
          </div>
        </div>

        {/* Fil des commentaires, du plus récent au plus ancien */}
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Suivi
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              · {commentaires.length} commentaire{commentaires.length > 1 ? "s" : ""}
            </span>
          </p>
          {commentaires.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Aucun commentaire pour l’instant. Notez ci-dessus le premier point d’avancement.
            </p>
          ) : (
            <ul className="space-y-2">
              {commentaires.map((c) => (
                <li
                  key={c.id}
                  className="group rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDateHeure(c.creeLe)}
                    </span>
                    <button
                      onClick={() =>
                        actionSurId(c.id, supprimerCommentaire, "Commentaire supprimé.")
                      }
                      className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                      aria-label="Supprimer le commentaire"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{c.contenu}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="flex-row flex-wrap gap-2">
          <TacheFormDialog
            action={renommerTache}
            tache={{ id: tache.id, nom: tache.nom }}
            titre="Renommer la tâche"
            trigger={
              <Button variant="outline" size="sm">
                Renommer
              </Button>
            }
          />
          <Button variant="outline" size="sm" onClick={() => void basculerTermine()}>
            {tache.termine ? "Rouvrir" : "Marquer terminée"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                Supprimer
              </Button>
            }
            titre="Supprimer cette tâche ?"
            description="La tâche et tous ses commentaires de suivi seront définitivement supprimés."
            confirmLabel="Supprimer"
            destructif
            onConfirm={supprimer}
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
