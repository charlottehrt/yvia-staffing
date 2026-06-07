// Hachage des mots de passe avec scrypt (intégré à Node, pas de dépendance).
// À n'utiliser QUE côté serveur (Node) : jamais dans le middleware (edge) ni le client.

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Renvoie "scrypt$<sel hex>$<hash hex>".
export function hasherMotDePasse(motDePasse: string): string {
  const sel = randomBytes(16);
  const hash = scryptSync(motDePasse, sel, 64);
  return `scrypt$${sel.toString("hex")}$${hash.toString("hex")}`;
}

// Comparaison en temps constant pour éviter les attaques temporelles.
export function verifierMotDePasse(motDePasse: string, stocke: string): boolean {
  const [algo, selHex, hashHex] = stocke.split("$");
  if (algo !== "scrypt" || !selHex || !hashHex) return false;
  const sel = Buffer.from(selHex, "hex");
  const hash = Buffer.from(hashHex, "hex");
  const test = scryptSync(motDePasse, sel, hash.length);
  return hash.length === test.length && timingSafeEqual(hash, test);
}
