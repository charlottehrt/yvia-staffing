import type { MetadataRoute } from "next";

// Manifest PWA : rend l'application installable (Android, iOS, desktop).
// Servi par Next sur /manifest.webmanifest et lié automatiquement dans le <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yvia - Dashboard",
    short_name: "Yvia",
    description: "Pilotage de la marge des freelances en mission",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
