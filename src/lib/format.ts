// Mise en forme des valeurs pour l'affichage (interface en français).

// Montant en euros avec séparateur de milliers, ex : 1250 -> "1 250 €".
export function formatEuro(montant: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(montant);
}

// Nombre de jours, ex : 13.2 -> "13,2".
export function formatJours(jours: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(jours);
}

// Mois en toutes lettres, ex : (2026, 6) -> "juin 2026".
export function formatMois(annee: number, mois: number): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(annee, mois - 1, 1))
  );
}

// Date "AAAA-MM-JJ" -> "JJ/MM/AAAA". Renvoie "-" si vide.
export function formatDate(dateISO: string | null): string {
  if (!dateISO) return "-";
  const [annee, mois, jour] = dateISO.split("-");
  return `${jour}/${mois}/${annee}`;
}

// Date/heure ISO complète -> "JJ/MM/AAAA à HH:MM" (heure locale). Renvoie "-" si
// vide. Utilisé pour horodater les commentaires de suivi des tâches.
export function formatDateHeure(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const date = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date} à ${heure}`;
}

// Pourcentage, ex : 0.2308 -> "23 %".
export function formatPourcent(ratio: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(ratio);
}
