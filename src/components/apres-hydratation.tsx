"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const abonnementVide = () => () => {};

// Les extensions de type gestionnaire de mots de passe (Norton, Dashlane…)
// réécrivent les champs d'identifiants dans le HTML serveur avant que React
// ne s'hydrate, ce qui fait échouer l'hydratation. Les formulaires concernés
// ne sont donc rendus qu'après le montage, le serveur livrant un substitut
// de même gabarit (`fallback`) pour éviter tout saut de mise en page.
export function ApresHydratation({
  fallback = null,
  children,
}: {
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const monte = useSyncExternalStore(
    abonnementVide,
    () => true,
    () => false
  );

  return monte ? children : fallback;
}

// Boîte au gabarit exact d'un <Input> (h-9, mêmes fond et rayon), pour
// composer les substituts passés à `ApresHydratation`.
export function ChampFactice() {
  return <div className="h-9 w-full rounded-xl bg-secondary dark:bg-input/30" />;
}
