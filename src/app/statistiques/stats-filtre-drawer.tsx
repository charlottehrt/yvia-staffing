"use client";
// Bouton entonnoir (sans libellé) ouvrant un drawer de filtres. Trois lignes :
// Clients, Freelances, Missions. Les trois se combinent en logique « ET ».

import { useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type Option = { value: string; label: string };

export function StatsFiltreDrawer({
  clients,
  freelances,
  missions,
  selClients,
  selFreelances,
  selMissions,
}: {
  clients: Option[];
  freelances: Option[];
  missions: Option[];
  selClients: string[];
  selFreelances: string[];
  selMissions: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [cl, setCl] = useState<string[]>(selClients);
  const [fr, setFr] = useState<string[]>(selFreelances);
  const [mi, setMi] = useState<string[]>(selMissions);

  const total = selClients.length + selFreelances.length + selMissions.length;

  function ouvrir(o: boolean) {
    setOpen(o);
    if (o) {
      // Ré-aligne sur l'URL à l'ouverture.
      setCl(selClients);
      setFr(selFreelances);
      setMi(selMissions);
    }
  }

  function appliquer() {
    const p = new URLSearchParams(searchParams.toString());
    const poser = (nom: string, valeurs: string[]) => {
      if (valeurs.length === 0) p.delete(nom);
      else p.set(nom, valeurs.join(","));
    };
    poser("clients", cl);
    poser("freelances", fr);
    poser("missions", mi);
    router.push(`${pathname}?${p.toString()}`);
    setOpen(false);
  }

  function reinitialiser() {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("clients");
    p.delete("freelances");
    p.delete("missions");
    router.push(`${pathname}?${p.toString()}`);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={ouvrir}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="Filtrer" className="relative">
            <Filter />
            {total > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {total}
              </span>
            ) : null}
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Filtres</SheetTitle>
          <p className="text-sm text-muted-foreground">
            Les filtres se combinent (logique « ET »).
          </p>
        </SheetHeader>

        <div className="space-y-5">
          <Section titre="Clients" options={clients} valeurs={cl} onChange={setCl} />
          <Section titre="Freelances" options={freelances} valeurs={fr} onChange={setFr} />
          <Section titre="Missions" options={missions} valeurs={mi} onChange={setMi} />
        </div>

        <SheetFooter className="flex-row justify-between">
          <Button variant="ghost" onClick={reinitialiser}>
            Réinitialiser
          </Button>
          <Button onClick={appliquer}>Appliquer</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  titre,
  options,
  valeurs,
  onChange,
}: {
  titre: string;
  options: Option[];
  valeurs: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(valeurs.includes(v) ? valeurs.filter((x) => x !== v) : [...valeurs, v]);
  }
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{titre}</p>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune option.</p>
      ) : (
        <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={valeurs.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
