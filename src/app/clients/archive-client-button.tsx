"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { basculerActifClient } from "./actions";

export function ArchiveClientButton({ id, actif }: { id: number; actif: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const fd = new FormData();
        fd.set("id", String(id));
        fd.set("actif", String(actif));
        const res = await basculerActifClient(fd);
        if (res.ok) toast.success(actif ? "Client archivé." : "Client réactivé.");
        else toast.error(res.message ?? "Action impossible.");
      }}
    >
      {actif ? "Archiver" : "Réactiver"}
    </Button>
  );
}
