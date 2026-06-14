import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

// enregistrerOutils importe @/db, qui exige DATABASE_URL au chargement. Lister
// les outils n'exécute aucun handler (donc aucune requête en base) : une URL
// factice suffit (le client postgres est paresseux). Import dynamique après
// avoir posé l'environnement.
process.env.DATABASE_URL ??= "postgres://placeholder:placeholder@localhost:5432/placeholder";
const { enregistrerOutils } = await import("./outils");

const OUTILS_ATTENDUS = [
  "lister_freelances",
  "lister_clients",
  "lister_missions",
  "lister_projets",
  "detail_projet",
  "planning_du_mois",
  "statistiques",
  "rechercher",
];

// Monte un serveur MCP réel avec les outils enregistrés et un client relié par
// un transport en mémoire, afin d'exercer le protocole de bout en bout.
async function clientConnecte() {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  enregistrerOutils(server);
  const [transportClient, transportServeur] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(transportClient), server.connect(transportServeur)]);
  return client;
}

describe("enregistrerOutils", () => {
  it("enregistre exactement les 8 outils attendus, listables via le protocole", async () => {
    const client = await clientConnecte();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...OUTILS_ATTENDUS].sort());
  });

  it("annonce chaque outil en lecture seule, avec description et schéma d'entrée objet", async () => {
    const client = await clientConnecte();
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, `${t.name} doit être en lecture seule`).toBe(true);
      expect((t.description ?? "").length, `${t.name} doit avoir une description`).toBeGreaterThan(0);
      expect(t.inputSchema?.type, `${t.name} doit exposer un schéma objet`).toBe("object");
    }
  });
});
