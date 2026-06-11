// Types partagés du système de drawers en cascade.
// Un drawer affiche le détail d'une « entité » (freelance, client, mission,
// projet). Les entités liées sont elles-mêmes cliquables : ouvrir l'une empile
// un nouveau niveau de détail, ce qui réalise une navigation « à l'infini ».

export type TypeEntite = "freelance" | "client" | "mission" | "projet" | "user";

export type EntiteRef = { type: TypeEntite; id: number };

// Un champ d'information simple (clé / valeur), non cliquable.
export type Info = { label: string; valeur: string };

// Un lien vers une autre entité (cliquable, ouvre un niveau de drawer).
export type Lien = {
  ref: EntiteRef;
  label: string;
  sous?: string;
  statut?: { actif: boolean; label: string };
};

// Une section listant des entités liées.
export type SectionLiens = { titre: string; liens: Lien[]; vide: string };

// Un champ éditable « au clic » (nom, TJM, budget...).
export type ChampEditable = { cle: string; label: string; valeur: string; type: "text" | "number" };

export type DetailEntite = {
  ref: EntiteRef;
  titre: string;
  sousTitre?: string;
  actif: boolean;
  champs: ChampEditable[]; // champs modifiables inline
  infos: Info[]; // indicateurs en lecture seule
  sections: SectionLiens[];
  actionLabel: string; // libellé du bouton d'(in)activation, ex. "Archiver" / "Désactiver"
};

export const LIBELLE_TYPE: Record<TypeEntite, string> = {
  freelance: "Freelance",
  client: "Client",
  mission: "Mission",
  projet: "Projet",
  user: "User",
};
