"use client";
// Barre de sous-onglets réutilisable (ex : Annuaire = Clients/Freelances,
// Finances = Réalisé/Prévisionnel). Met en valeur l'onglet actif.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SousOnglets({ onglets }: { onglets: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1">
      {onglets.map((o) => {
        const actif = pathname === o.href || pathname.startsWith(o.href + "/");
        return (
          <Link
            key={o.href}
            href={o.href}
            className={`rounded-md px-3 py-1.5 text-sm ${
              actif
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

// Les deux regroupements de l'application.
export const ONGLETS_ANNUAIRE = [
  { href: "/clients", label: "Clients" },
  { href: "/freelances", label: "Freelances" },
];

export const ONGLETS_FINANCES = [
  { href: "/statistiques", label: "Statistiques" },
  { href: "/previsionnel", label: "Prévisionnel" },
];
