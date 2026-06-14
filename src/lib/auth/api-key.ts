// Génération et vérification des clés API (accès MCP). Réservé au serveur (Node).
//
// La clé en clair n'est montrée qu'une seule fois, à sa création. En base on ne
// garde que son empreinte SHA-256 (`tokenHash`). Les clés étant aléatoires à
// haute entropie, un hash rapide suffit (pas de risque de force brute comme sur
// un mot de passe) et permet une recherche directe par empreinte.

import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import type { Role } from "./session";

// Préfixe lisible : permet de reconnaître une clé Yvia et de filtrer côté
// vérification avant même de toucher la base.
export const PREFIXE_CLE = "yvia_sk_";

// Nombre de caractères du token affichés dans la liste (après le préfixe).
const LONGUEUR_PREFIXE_AFFICHE = 8;

// Au-delà de cet intervalle, on rafraîchit la date de dernier usage. Évite une
// écriture en base à chaque appel d'outil MCP (un échange peut en enchaîner).
const THROTTLE_USAGE_MS = 60_000;

export type CleGeneree = {
  token: string; // clé complète en clair (à ne montrer qu'une seule fois)
  tokenHash: string; // empreinte stockée en base
  prefixe: string; // début affichable (PREFIXE_CLE + quelques caractères)
};

// Empreinte SHA-256 (hex) d'une clé. Déterministe : sert aussi bien à stocker
// qu'à rechercher.
export function hacherToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Génère une nouvelle clé : `yvia_sk_` suivi de 32 caractères aléatoires.
export function genererCleApi(): CleGeneree {
  const aleatoire = randomBytes(24).toString("base64url"); // 24 octets -> 32 caractères
  const token = `${PREFIXE_CLE}${aleatoire}`;
  return {
    token,
    tokenHash: hacherToken(token),
    prefixe: token.slice(0, PREFIXE_CLE.length + LONGUEUR_PREFIXE_AFFICHE),
  };
}

export type UtilisateurCle = {
  apiKeyId: number;
  userId: number;
  email: string;
  role: Role;
};

// Vérifie une clé présentée en Bearer. Recherche par empreinte, rejette les
// clés inconnues ou rattachées à un compte désactivé, puis met à jour (au plus
// une fois par minute) la date de dernier usage. Renvoie l'utilisateur associé
// ou `null` si la clé est invalide.
export async function verifierCleApi(
  token: string | undefined | null
): Promise<UtilisateurCle | null> {
  if (!token || !token.startsWith(PREFIXE_CLE)) return null;
  const tokenHash = hacherToken(token);

  const [ligne] = await db
    .select({
      apiKeyId: apiKeys.id,
      dernierUsageLe: apiKeys.dernierUsageLe,
      userId: users.id,
      email: users.email,
      role: users.role,
      actif: users.actif,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.tokenHash, tokenHash));

  if (!ligne || !ligne.actif) return null;

  // Rafraîchissement throttlé du dernier usage (best-effort).
  const maintenant = Date.now();
  const dernier = ligne.dernierUsageLe ? Date.parse(ligne.dernierUsageLe) : 0;
  if (!Number.isFinite(dernier) || maintenant - dernier > THROTTLE_USAGE_MS) {
    await db
      .update(apiKeys)
      .set({ dernierUsageLe: new Date(maintenant).toISOString() })
      .where(eq(apiKeys.id, ligne.apiKeyId));
  }

  return {
    apiKeyId: ligne.apiKeyId,
    userId: ligne.userId,
    email: ligne.email,
    role: ligne.role === "user" ? "user" : "admin",
  };
}
