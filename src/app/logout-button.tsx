"use client";

import { Button } from "@/components/ui/button";
import { deconnexion } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={deconnexion}>
      <Button type="submit" variant="outline" size="sm">
        Déconnexion
      </Button>
    </form>
  );
}
