"use client";

import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { basculerActifChargeFixe } from "./actions";

export function ToggleActifChargeButton({
  id,
  libelle,
  actif,
}: {
  id: number;
  libelle: string;
  actif: boolean;
}) {
  async function basculer() {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("actif", String(actif));
    const res = await basculerActifChargeFixe(fd);
    if (res.ok) toast.success(actif ? "Charge archivée." : "Charge réactivée.");
    else toast.error(res.message ?? "Action impossible.");
  }

  // Réactiver : sans risque, un seul clic.
  if (!actif) {
    return (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Réactiver la charge"
        title="Réactiver"
        onClick={basculer}
      >
        <ArchiveRestore />
      </Button>
    );
  }

  // Archiver : confirmation (réversible, mais on évite l'archivage accidentel).
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label="Archiver la charge" title="Archiver">
          <Archive />
        </Button>
      }
      titre={`Archiver « ${libelle} » ?`}
      description="Elle disparaîtra de la grille active. Vous pourrez la réactiver à tout moment depuis le filtre « Archivées »."
      confirmLabel="Archiver"
      onConfirm={basculer}
    />
  );
}
