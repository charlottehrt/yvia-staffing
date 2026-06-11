"use client";
// Ligne de freelance entièrement cliquable : ouvre le drawer du freelance.
// En vue Actifs, une colonne « Planning » permet d'afficher ou de masquer le
// freelance dans le planning du dashboard.

import { toast } from "sonner";
import { TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatEuro } from "@/lib/format";
import { useDrawer } from "@/app/_drawer/drawer-stack";
import type { EntiteRef } from "@/app/_drawer/types";
import { basculerAfficherPlanning } from "./actions";

type FreelanceRowProps = {
  id: number;
  nom: string;
  gain: number;
  afficherPlanning?: boolean; // absent = pas de colonne Planning (vue Archives)
};

type FreelanceRowViewProps = FreelanceRowProps & {
  onOpen: (ref: EntiteRef) => void;
  onTogglePlanning?: (afficher: boolean) => void;
};

export function FreelanceRowView({
  id,
  nom,
  gain,
  afficherPlanning,
  onOpen,
  onTogglePlanning,
}: FreelanceRowViewProps) {
  return (
    <TableRow onClick={() => onOpen({ type: "freelance", id })} className="cursor-pointer">
      <TableCell className="font-medium">{nom}</TableCell>
      <TableCell className="text-right">{formatEuro(gain)}</TableCell>
      {afficherPlanning !== undefined ? (
        // stopPropagation : basculer l'interrupteur ne doit pas ouvrir le drawer.
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={afficherPlanning}
            onCheckedChange={(afficher) => onTogglePlanning?.(afficher)}
            aria-label="Afficher dans le planning"
          />
        </TableCell>
      ) : null}
    </TableRow>
  );
}

export function FreelanceRow(props: FreelanceRowProps) {
  const { ouvrir } = useDrawer();

  async function basculerPlanning(afficher: boolean) {
    const formData = new FormData();
    formData.set("id", String(props.id));
    formData.set("afficher", String(afficher));
    const res = await basculerAfficherPlanning(formData);
    if (res.ok) toast.success(afficher ? "Freelance affiché dans le planning." : "Freelance masqué du planning.");
    else toast.error(res.message ?? "Action impossible.");
  }

  return <FreelanceRowView {...props} onOpen={ouvrir} onTogglePlanning={basculerPlanning} />;
}
