import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEuro } from "@/lib/format";

type IndicateursPrevisionnelProps = {
  totalCaMax: number;
  totalCaProb: number;
  totalMargeMax: number;
  totalMargeProb: number;
};

export function IndicateursPrevisionnel({
  totalCaMax,
  totalCaProb,
  totalMargeMax,
  totalMargeProb,
}: IndicateursPrevisionnelProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Indicateur titre="CA max (cumulé)" valeur={formatEuro(totalCaMax)} />
      <Indicateur titre="CA probable (cumulé)" valeur={formatEuro(totalCaProb)} />
      <Indicateur titre="Marge maximum (cumulée)" valeur={formatEuro(totalMargeMax)} />
      <Indicateur titre="Marge probable (cumulée)" valeur={formatEuro(totalMargeProb)} />
    </div>
  );
}

function Indicateur({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-normal text-muted-foreground">{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl">{valeur}</p>
      </CardContent>
    </Card>
  );
}
