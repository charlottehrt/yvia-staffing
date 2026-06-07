// Constantes partagées par la page (serveur) et les filtres (client).
// Volontairement dans un fichier neutre (pas "use client") pour pouvoir être
// importées côté serveur sans passer par la frontière client.

export const PERIODES = [
  { key: "mois", label: "Ce mois" },
  { key: "trimestre", label: "Trimestre en cours" },
  { key: "annee", label: "Année en cours" },
  { key: "12mois", label: "12 prochains mois" },
  { key: "debut", label: "Depuis le début" },
  { key: "perso", label: "Personnalisé" },
] as const;

export const GROUPES = [
  { key: "mois", label: "Mois" },
  { key: "freelance", label: "Freelance" },
  { key: "client", label: "Client" },
  { key: "mission", label: "Mission" },
] as const;
