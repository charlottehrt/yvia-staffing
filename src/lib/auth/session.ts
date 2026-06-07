// Jeton de session signé (HMAC-SHA256) via la Web Crypto API, donc utilisable
// à la fois côté serveur (Node) et dans le middleware (edge). N'importe rien de
// spécifique à Node ni à next/headers pour rester compatible edge.

export const SESSION_COOKIE = "yvia_session";
export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export type Session = { userId: number; email: string; exp: number };

const TEXT = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET manquant : ajoutez-le dans .env");
  return s;
}

function b64urlFromString(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function stringFromB64url(s: string): string {
  return decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
}
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function cle(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    TEXT.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signerSession(session: Session): Promise<string> {
  const payload = b64urlFromString(JSON.stringify(session));
  const sig = await crypto.subtle.sign("HMAC", await cle(), TEXT.encode(payload));
  return `${payload}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

export async function verifierSession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await cle(),
      bytesFromB64url(sig) as unknown as BufferSource,
      TEXT.encode(payload) as unknown as BufferSource
    );
    if (!ok) return null;
    const session = JSON.parse(stringFromB64url(payload)) as Session;
    if (typeof session.exp !== "number" || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
