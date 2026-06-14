"use client";

import { useState } from "react";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ResultatCreation, Resultat } from "./api-keys-actions";

export type CleAffichee = {
  id: number;
  nom: string;
  prefixe: string;
  creeLe: string;
  dernierUsageLe: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Jamais";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("fr-FR");
}

async function copier(texte: string, succes: string) {
  try {
    await navigator.clipboard.writeText(texte);
    toast.success(succes);
  } catch {
    toast.error("Copie impossible, sélectionnez le texte manuellement.");
  }
}

export function ApiKeysCard({
  mcpUrl,
  cles,
  creer,
  revoquer,
}: {
  mcpUrl: string;
  cles: CleAffichee[];
  creer: (formData: FormData) => Promise<ResultatCreation>;
  revoquer: (formData: FormData) => Promise<Resultat>;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Accès API (MCP)</CardTitle>
        <GenererCleDialog creer={creer} mcpUrl={mcpUrl} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Connectez un client compatible MCP (Claude, etc.) pour interroger vos données — projets,
          prestas, missions, planning, marge — en posant des questions. L&apos;accès est en{" "}
          <strong>lecture seule</strong>, mais une clé donne accès à <strong>toutes</strong> les
          données de l&apos;application : ne la partagez pas.
        </p>

        <div className="space-y-2">
          <Label htmlFor="mcp-url">URL de connexion</Label>
          <div className="flex gap-2">
            <Input id="mcp-url" value={mcpUrl} readOnly className="min-w-0 font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copier(mcpUrl, "URL copiée.")}
            >
              <Copy />
              <span className="sr-only">Copier l&apos;URL</span>
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Clés existantes</Label>
          {cles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune clé pour le moment. Générez-en une pour connecter un client MCP.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {cles.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nom}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{c.prefixe}…</span> · créée le {formatDate(c.creeLe)}{" "}
                      · dernier usage : {formatDate(c.dernierUsageLe)}
                    </p>
                  </div>
                  <ConfirmDialog
                    titre="Révoquer cette clé ?"
                    description="Les clients qui l'utilisent perdront immédiatement l'accès. Cette action est définitive."
                    confirmLabel="Révoquer"
                    destructif
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={`Révoquer ${c.nom}`}>
                        <Trash2 />
                      </Button>
                    }
                    onConfirm={async () => {
                      const fd = new FormData();
                      fd.set("id", String(c.id));
                      const res = await revoquer(fd);
                      if (res.ok) toast.success("Clé révoquée.");
                      else toast.error(res.message ?? "Une erreur est survenue.");
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GenererCleDialog({
  creer,
  mcpUrl,
}: {
  creer: (formData: FormData) => Promise<ResultatCreation>;
  mcpUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const snippet = token
    ? JSON.stringify(
        {
          mcpServers: {
            "yvia-suivi-marge": {
              url: mcpUrl,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2
      )
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(valeur) => {
        setOpen(valeur);
        if (!valeur) setToken(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Générer une clé
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Générer une clé API</DialogTitle>
        </DialogHeader>

        {token ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cle-token">Votre clé</Label>
              <div className="flex gap-2">
                <Input id="cle-token" value={token} readOnly className="min-w-0 font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copier(token, "Clé copiée.")}
                >
                  <Copy />
                  <span className="sr-only">Copier la clé</span>
                </Button>
              </div>
              <p className="text-xs text-destructive">
                Copiez-la maintenant : elle ne sera plus jamais affichée.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cle-config">Configuration du client MCP</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copier(snippet, "Configuration copiée.")}
                >
                  <Copy />
                  Copier
                </Button>
              </div>
              <pre
                id="cle-config"
                className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs"
              >
                {snippet}
              </pre>
              <p className="text-xs text-muted-foreground">
                Pour un client qui ne gère pas les en-têtes, utilisez le pont{" "}
                <span className="font-mono">npx mcp-remote {mcpUrl} --header
                &quot;Authorization:Bearer {token}&quot;</span>.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setOpen(false)}>
                Terminé
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            action={async (formData) => {
              const res = await creer(formData);
              if (res.ok && res.token) {
                setToken(res.token);
                toast.success("Clé créée.");
              } else {
                toast.error(res.message ?? "Une erreur est survenue.");
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="cle-nom">Nom de la clé *</Label>
              <Input id="cle-nom" name="nom" placeholder="Claude Desktop" required maxLength={80} />
              <p className="text-xs text-muted-foreground">
                Un libellé pour reconnaître cette clé (l&apos;appareil ou le client connecté).
              </p>
            </div>
            <DialogFooter>
              <Button type="submit">
                <KeyRound />
                Générer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
