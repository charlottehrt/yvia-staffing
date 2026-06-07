"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PERIODES, GROUPES } from "./stats-config";

const chip = (actif: boolean) =>
  `rounded-md px-3 py-1.5 text-sm ${
    actif ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
  }`;

const inputCls =
  "h-9 rounded-xl border border-transparent bg-secondary px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function StatsFiltres({
  periode,
  grouper,
  debut,
  fin,
}: {
  periode: string;
  grouper: string;
  debut: string; // "AAAA-MM" pour la plage personnalisée
  fin: string; // "AAAA-MM"
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Construit un lien en conservant les autres paramètres de l'URL.
  function lienAvec(modif: Record<string, string>): string {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(modif)) p.set(k, v);
    return `${pathname}?${p.toString()}`;
  }

  return (
    <div className="space-y-3">
      {/* Période */}
      <div>
        <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Période
        </p>
        <div className="flex flex-wrap gap-1">
          {PERIODES.map((x) => (
            <Link key={x.key} href={lienAvec({ periode: x.key })} className={chip(periode === x.key)}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Plage personnalisée (mois à mois) */}
      {periode === "perso" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            router.push(
              lienAvec({
                periode: "perso",
                debut: String(fd.get("debut")),
                fin: String(fd.get("fin")),
              })
            );
          }}
          className="flex flex-wrap items-center gap-2 text-sm"
        >
          <span>De</span>
          <input type="month" name="debut" defaultValue={debut} className={inputCls} />
          <span>à</span>
          <input type="month" name="fin" defaultValue={fin} className={inputCls} />
          <Button type="submit" size="sm">
            Appliquer
          </Button>
        </form>
      ) : null}

      {/* Regrouper par */}
      <div>
        <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Regrouper par
        </p>
        <div className="flex flex-wrap gap-1">
          {GROUPES.map((x) => (
            <Link key={x.key} href={lienAvec({ grouper: x.key })} className={chip(grouper === x.key)}>
              {x.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
