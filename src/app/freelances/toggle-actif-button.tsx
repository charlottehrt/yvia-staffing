"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { basculerActif } from "./actions";

export function ToggleActifButton({ id, actif }: { id: number; actif: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        const formData = new FormData();
        formData.set("id", String(id));
        formData.set("actif", String(actif));
        const res = await basculerActif(formData);
        if (res.ok) toast.success(actif ? "Freelance archivé." : "Freelance réactivé.");
        else toast.error(res.message ?? "Action impossible.");
      }}
    >
      {actif ? "Archiver" : "Réactiver"}
    </Button>
  );
}
