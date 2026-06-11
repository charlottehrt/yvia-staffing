"use client";
// Navigation latérale de l'application (plateforme SaaS).
// L'onglet actif est mis en valeur ; comme il est coloré, les pages n'ont plus
// besoin de répéter leur titre. Le bloc administrateur est en bas : une icône
// qui révèle au survol « Mon nom » et « Déconnexion ».

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  FolderKanban,
  Users,
  UserCog,
  Building2,
  BarChart3,
  UserCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { deconnexion } from "@/app/login/actions";

// `match` = préfixes de chemin qui rendent l'onglet actif (regroupements de sous-pages).
type Lien = { href: string; label: string; icone: LucideIcon; match?: string[] };

const LIENS: Lien[] = [
  { href: "/", label: "Dashboard", icone: LayoutDashboard, match: ["/"] },
  { href: "/missions", label: "Missions", icone: Briefcase },
  { href: "/projets", label: "Projets", icone: FolderKanban },
  { href: "/freelances", label: "Freelances", icone: Users },
  { href: "/clients", label: "Clients", icone: Building2 },
  { href: "/statistiques", label: "Pilotage", icone: BarChart3 },
  { href: "/users", label: "Users", icone: UserCog },
];

export function Sidebar({ nomAffiche, admin }: { nomAffiche: string; admin: boolean }) {
  const pathname = usePathname();
  const liens = admin ? LIENS : LIENS.filter((lien) => lien.href !== "/users");

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r bg-background">
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo-yvia.svg"
            alt="Yvia"
            width={107}
            height={40}
            className="h-7 w-auto"
            priority
          />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {liens.map((lien) => {
          const motifs = lien.match ?? [lien.href];
          const actif = motifs.some((m) =>
            m === "/" ? pathname === "/" : pathname.startsWith(m)
          );
          const Icone = lien.icone;
          return (
            <Link
              key={lien.href}
              href={lien.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                actif
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icone className="size-4 shrink-0" />
              {lien.label}
            </Link>
          );
        })}
      </nav>

      {/* Bloc compte : icône en bas, menu au survol (Mon nom / Déconnexion). */}
      <div className="group relative px-3 pb-4 pt-2">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground group-focus-within:bg-muted group-focus-within:text-foreground"
        >
          <UserCircle className="size-5 shrink-0" />
          <span className="truncate">{nomAffiche}</span>
        </button>

        <div className="invisible absolute bottom-full left-3 right-3 mb-1 translate-y-1 rounded-md border bg-popover p-1 opacity-0 shadow-md ring-1 ring-foreground/5 transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <Link
            href="/parametres"
            className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            <UserCircle className="size-4" />
            Mon nom
          </Link>
          <form action={deconnexion}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              <LogOut className="size-4" />
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
