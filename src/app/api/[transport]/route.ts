// Endpoint MCP (Model Context Protocol) en lecture seule.
//
// Transport « Streamable HTTP » exposé sur /api/mcp (le segment [transport] vaut
// "mcp" ou "sse"). L'authentification se fait par clé API en en-tête
// Authorization: Bearer <clé>. Le middleware (src/proxy.ts) laisse passer /api/
// sans cookie de session : c'est ici qu'on contrôle l'accès, via le token.
//
// La route tourne sur le runtime Node.js par défaut (accès base de données +
// node:crypto pour le hachage des clés) : ne pas basculer en edge.

import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { enregistrerOutils } from "@/lib/mcp/outils";
import { verifierCleApi } from "@/lib/auth/api-key";

export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    enregistrerOutils(server);
  },
  {
    serverInfo: { name: "yvia-suivi-marge", version: "1.0.0" },
  },
  {
    basePath: "/api", // endpoints dérivés : /api/mcp (Streamable HTTP) et /api/sse
    maxDuration: 60,
    verboseLogs: false,
  }
);

// Vérifie la clé API présentée en Bearer. Renvoie l'identité associée (utilisée
// par le SDK comme contexte d'auth) ou undefined -> 401 (required: true).
async function verifierToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const utilisateur = await verifierCleApi(bearerToken);
  if (!utilisateur || !bearerToken) return undefined;
  return {
    token: bearerToken,
    clientId: String(utilisateur.userId),
    scopes: ["read"],
    extra: { userId: utilisateur.userId, email: utilisateur.email, role: utilisateur.role },
  };
}

const authHandler = withMcpAuth(handler, verifierToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
