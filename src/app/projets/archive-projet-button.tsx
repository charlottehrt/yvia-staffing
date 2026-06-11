"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { basculerActifProjet } from "./actions";

export function ArchiveProjetButton({ id, actif }: { id: number; actif: boolean }) {
  async function basculer() {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("actif", String(actif));
    const res = await basculerActifProjet(fd);
    if (res.ok) toast.success(actif ? "Projet terminé." : "Projet rouvert.");
    else toast.error(res.message ?? "Action impossible.");
  }

  if (!actif) {
    return (
      <Button variant="outline" size="sm" onClick={basculer}>
        Réouvrir
      </Button>
    );
  }

  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          Terminer
        </Button>
      }
      titre="Terminer ce projet ?"
      description="Il n'apparaîtra plus dans les listes actives. Vous pourrez le retrouver depuis l'onglet Terminés."
      confirmLabel="Terminer"
      destructif
      onConfirm={basculer}
    />
  );
}
