"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ApresHydratation, ChampFactice } from "@/components/apres-hydratation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connexion } from "./actions";

export default function PageConnexion() {
  const [enCours, setEnCours] = useState(false);

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-3 text-center">
          <Image src="/logo-yvia.svg" alt="Yvia" width={107} height={40} className="h-8 w-auto" priority />
          <CardTitle>Connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <ApresHydratation fallback={<SqueletteConnexion />}>
            <form
              action={async (formData) => {
                setEnCours(true);
                const res = await connexion(formData);
                setEnCours(false);
                toast.error(res.message ?? "Une erreur est survenue.");
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="username" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="motDePasse">Mot de passe</Label>
                <Input
                  id="motDePasse"
                  name="motDePasse"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={enCours}>
                {enCours ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </ApresHydratation>
        </CardContent>
      </Card>
    </div>
  );
}

function SqueletteConnexion() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <ChampFactice />
      </div>
      <div className="space-y-2">
        <Label>Mot de passe</Label>
        <ChampFactice />
      </div>
      <Button className="w-full" disabled>
        Se connecter
      </Button>
    </div>
  );
}
