"use client";
// Cellule éditable d'un mois pour une charge fixe.
// - Mois hors période (avant le début / après la fin) : cellule grisée, non éditable.
// - Mois actif sans saisie : le champ est vide et affiche le montant récurrent en
//   filigrane (placeholder) ; ce montant est bien compté dans les totaux.
// - Mois actif avec saisie : la valeur saisie remplace le montant récurrent.
// On enregistre à la perte de focus (blur), façon tableur, et seulement si la
// valeur a changé.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { enregistrerValeurChargeFixe } from "./actions";

export function CelluleCharge({
  chargeFixeId,
  mois,
  active,
  saisie,
  defaut,
}: {
  chargeFixeId: number;
  mois: string; // "AAAA-MM"
  active: boolean;
  saisie: number | null;
  defaut: number;
}) {
  const valeurInitiale = saisie === null ? "" : String(saisie);
  const [valeur, setValeur] = useState(valeurInitiale);
  const [enregistre, setEnregistre] = useState(valeurInitiale);
  const [pending, startTransition] = useTransition();

  if (!active) {
    return <td className="p-1 text-center align-middle text-muted-foreground/40">·</td>;
  }

  function sauvegarder() {
    const courant = valeur.trim();
    if (courant === enregistre) return; // rien n'a changé
    if (courant !== "" && (!Number.isFinite(Number(courant)) || Number(courant) < 0)) {
      toast.error("Montant invalide.");
      setValeur(enregistre);
      return;
    }
    startTransition(async () => {
      const res = await enregistrerValeurChargeFixe(
        chargeFixeId,
        mois,
        courant === "" ? null : courant
      );
      if (res.ok) {
        setEnregistre(courant);
      } else {
        toast.error(res.message ?? "Enregistrement impossible.");
        setValeur(enregistre);
      }
    });
  }

  const modifie = enregistre !== "";

  return (
    <td className="p-1 align-middle">
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        aria-label={`Montant ${mois}`}
        value={valeur}
        placeholder={String(defaut)}
        disabled={pending}
        onChange={(e) => setValeur(e.target.value)}
        onBlur={sauvegarder}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(
          "h-8 w-20 rounded-md border border-transparent bg-transparent px-2 text-right text-sm tabular-nums outline-none transition-colors",
          "placeholder:text-muted-foreground/50 hover:bg-secondary focus:border-ring focus:bg-secondary focus:ring-2 focus:ring-ring/40",
          modifie ? "font-medium text-foreground" : "text-muted-foreground",
          pending && "opacity-50"
        )}
      />
    </td>
  );
}
