"use client";
// Enregistre le service worker (PWA) en production. En développement, on
// désinscrit tout worker résiduel pour ne pas servir d'assets périmés.

import { useEffect } from "react";

export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Échec silencieux : l'application fonctionne sans service worker.
    });
  }, []);

  return null;
}
