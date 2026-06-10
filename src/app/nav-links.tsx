"use client";
// Composant client : il a besoin de connaître la page active pour la mettre en valeur.

import Link from "next/link";
import { usePathname } from "next/navigation";

// `match` = préfixes de chemin qui rendent l'onglet actif (pour les regroupements).
const liens = [
  { href: "/", label: "Planning", match: ["/"] },
  { href: "/missions", label: "Missions" },
  { href: "/projets", label: "Projets" },
  { href: "/clients", label: "Annuaire", match: ["/clients", "/freelances"] },
  { href: "/statistiques", label: "Finances", match: ["/statistiques", "/previsionnel"] },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {liens.map((lien) => {
        const motifs = lien.match ?? [lien.href];
        const actif = motifs.some((m) =>
          m === "/" ? pathname === "/" : pathname.startsWith(m)
        );
        return (
          <Link
            key={lien.href}
            href={lien.href}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              actif
                ? "bg-secondary font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {lien.label}
          </Link>
        );
      })}
    </>
  );
}
