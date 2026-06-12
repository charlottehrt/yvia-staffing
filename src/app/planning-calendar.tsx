"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatEuro, formatDate } from "@/lib/format";
import { ajouterFreelanceLocal, ajouterMissionPlanningLocal } from "@/lib/entity-options";
import { FreelanceFormDialog } from "./freelances/freelance-form-dialog";
import { creerFreelance } from "./freelances/actions";
import { MissionFormDialog } from "./missions/mission-form-dialog";
import { creerMission } from "./missions/actions";
import { affecterJours, libererJours, modifierTjmAffectation } from "./planning-actions";
import {
  ajouterEncaissement,
  supprimerEncaissement,
  ajouterDecaissement,
  supprimerDecaissement,
  ajouterJalon,
  supprimerJalon,
} from "./projets/actions";

export type Jour = {
  date: string; // AAAA-MM-JJ
  num: number; // numéro du jour
  lettre: string; // L, M, M, J, V, S, D
  weekend: boolean;
  ferie: boolean;
  estAujourdhui: boolean;
};

export type MissionOption = {
  id: number;
  nom: string;
  clientNom: string;
  couleur: Couleur;
};
export type Couleur = { bg: string; fg: string };

export type LigneFreelance = {
  id: number;
  nom: string;
  missions: MissionOption[]; // missions disponibles au planning pour ce freelance
  // affectations: date -> mission affectée (avec le TJM figé du jour)
  cellules: Record<
    string,
    {
      missionNom: string;
      clientNom: string;
      couleur: Couleur;
      tjmAchat: string;
      tjmVente: string;
    }
  >;
};

export type EvenementProjet = {
  id: number;
  type: "encaissement" | "decaissement" | "jalon";
  montant: string | null; // null pour un jalon (pas de montant)
  libelle: string | null;
  freelanceNom: string | null; // renseigné pour un décaissement
};

export type LigneProjet = {
  id: number;
  nom: string;
  clientNom: string;
  budget: string; // budget du projet (plafond des encaissements / décaissements)
  evenements: Record<string, EvenementProjet[]>; // date -> événements
};

const COULEURS_MISSION: Couleur[] = [
  { bg: "#0571ed", fg: "#ffffff" },
  { bg: "#0b172b", fg: "#ffffff" },
  { bg: "#2e8b8b", fg: "#ffffff" },
  { bg: "#52698f", fg: "#ffffff" },
  { bg: "#5b6fb0", fg: "#ffffff" },
  { bg: "#5a8f6b", fg: "#ffffff" },
  { bg: "#7a5f99", fg: "#ffffff" },
  { bg: "#b07d3c", fg: "#ffffff" },
];

export function PlanningCalendar({
  jours,
  lignes,
  projets,
  freelancesActifs,
  clientsActifs,
}: {
  jours: Jour[];
  lignes: LigneFreelance[];
  projets: LigneProjet[];
  freelancesActifs: { id: number; prenom: string; nom: string }[];
  clientsActifs: { id: number; nom: string }[];
}) {
  const [lignesPlanning, setLignesPlanning] = useState(lignes);
  const [freelancesOptions, setFreelancesOptions] = useState(freelancesActifs);
  const [freelanceDecaissementId, setFreelanceDecaissementId] = useState("");

  // Pop-up d'événements d'un projet, pour une date donnée.
  const [popupProjet, setPopupProjet] = useState<{ projetId: number; date: string } | null>(null);
  // Étape d'ajout d'un événement dans le pop-up projet :
  // "" = bouton « Ajouter un événement » ; "menu" = liste déroulante des types ;
  // sinon = formulaire du type choisi.
  const [typeAjout, setTypeAjout] = useState<
    "" | "menu" | "encaissement" | "decaissement" | "jalon"
  >("");
  // Sélection en cours : un freelance + une plage d'indices de jours.
  const [selection, setSelection] = useState<{
    freelanceId: number;
    debut: number;
    fin: number;
  } | null>(null);
  const [glisse, setGlisse] = useState(false);
  const [popup, setPopup] = useState<{ freelanceId: number; dates: string[] } | null>(null);

  // Fin du glissé même si on relâche la souris hors de la grille.
  useEffect(() => {
    function onUp() {
      if (glisse && selection) {
        const [min, max] = [
          Math.min(selection.debut, selection.fin),
          Math.max(selection.debut, selection.fin),
        ];
        const dates = jours.slice(min, max + 1).map((j) => j.date);
        setPopup({ freelanceId: selection.freelanceId, dates });
      }
      setGlisse(false);
    }
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [glisse, selection, jours]);

  function dansSelection(freelanceId: number, index: number) {
    if (!selection || selection.freelanceId !== freelanceId) return false;
    const [min, max] = [
      Math.min(selection.debut, selection.fin),
      Math.max(selection.debut, selection.fin),
    ];
    return index >= min && index <= max;
  }

  const ligneActive = popup ? lignesPlanning.find((l) => l.id === popup.freelanceId) : null;

  function fermerPopup() {
    setPopup(null);
    setSelection(null);
  }

  async function choisirMission(missionId: number) {
    if (!popup) return;
    const res = await affecterJours(missionId, popup.freelanceId, popup.dates);
    if (res.ok) toast.success("Planning mis à jour.");
    else toast.error(res.message ?? "Erreur.");
    fermerPopup();
  }

  async function liberer() {
    if (!popup) return;
    const res = await libererJours(popup.freelanceId, popup.dates);
    if (res.ok) toast.success("Jours libérés.");
    else toast.error(res.message ?? "Erreur.");
    fermerPopup();
  }

  async function enregistrerTarifJour(tjmAchat: string, tjmVente: string) {
    if (!popup) return;
    const res = await modifierTjmAffectation(
      popup.freelanceId,
      popup.dates[0],
      tjmAchat,
      tjmVente
    );
    if (res.ok) toast.success("Tarif du jour mis à jour.");
    else toast.error(res.message ?? "Erreur.");
    fermerPopup();
  }

  // Case unique déjà occupée : on peut éditer son TJM directement.
  const celluleUnique =
    popup && popup.dates.length === 1 && ligneActive
      ? ligneActive.cellules[popup.dates[0]] ?? null
      : null;

  // Pop-up projet : on lit les données fraîches depuis les props (mises à jour après action).
  const projetActif = popupProjet ? projets.find((p) => p.id === popupProjet.projetId) ?? null : null;
  const evenementsJour =
    projetActif && popupProjet ? projetActif.evenements[popupProjet.date] ?? [] : [];
  // Budget du projet : plafond des encaissements / décaissements saisissables.
  const budgetProjet = projetActif ? Number(projetActif.budget) : 0;

  async function ajouterEnc(fd: FormData) {
    const res = await ajouterEncaissement(fd);
    if (res.ok) {
      toast.success("Encaissement ajouté.");
      setTypeAjout("");
    } else toast.error(res.message ?? "Erreur.");
  }
  async function ajouterDec(fd: FormData) {
    const res = await ajouterDecaissement(fd);
    if (res.ok) {
      toast.success("Décaissement ajouté.");
      setTypeAjout("");
      setFreelanceDecaissementId("");
    } else toast.error(res.message ?? "Erreur.");
  }
  async function ajouterJal(fd: FormData) {
    const res = await ajouterJalon(fd);
    if (res.ok) {
      toast.success("Jalon ajouté.");
      setTypeAjout("");
    } else toast.error(res.message ?? "Erreur.");
  }
  async function supprimerEv(ev: EvenementProjet) {
    const fd = new FormData();
    fd.set("id", String(ev.id));
    const res =
      ev.type === "encaissement"
        ? await supprimerEncaissement(fd)
        : ev.type === "decaissement"
          ? await supprimerDecaissement(fd)
          : await supprimerJalon(fd);
    if (res.ok) toast.success("Événement supprimé.");
    else toast.error(res.message ?? "Erreur.");
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="border-collapse select-none text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-44 border-b border-border bg-card px-3 py-2 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Projet / Freelance
            </th>
            {jours.map((j) => (
              <th
                key={j.date}
                className={`w-9 border-b border-l px-0 py-1 text-center text-xs font-medium ${
                  j.estAujourdhui
                    ? "border-primary bg-primary text-primary-foreground"
                    : `border-border ${
                        j.weekend || j.ferie
                          ? "bg-secondary text-muted-foreground"
                          : "text-muted-foreground"
                      }`
                }`}
                title={
                  j.estAujourdhui ? "Aujourd'hui" : j.ferie ? "Jour férié" : undefined
                }
              >
                <div>{j.lettre}</div>
                <div className={j.estAujourdhui ? "font-semibold" : "text-foreground"}>
                  {j.num}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Lignes de projets (forfait) : on y pose les encaissements / décaissements */}
          {projets.map((p) => (
            <tr key={`projet-${p.id}`} className="bg-muted/30">
              <td className="sticky left-0 z-10 border-b border-border bg-muted/30 px-3 py-1 whitespace-nowrap">
                <span className="font-medium">{p.nom}</span>
                <span className="ml-1 text-xs text-muted-foreground">forfait</span>
              </td>
              {jours.map((j) => {
                const ev = p.evenements[j.date] ?? [];
                const nbEnc = ev.filter((e) => e.type === "encaissement").length;
                const nbDec = ev.filter((e) => e.type === "decaissement").length;
                const nbJal = ev.filter((e) => e.type === "jalon").length;
                return (
                  <td
                    key={j.date}
                    onClick={() => {
                      setPopupProjet({ projetId: p.id, date: j.date });
                      setTypeAjout("");
                    }}
                    title={`${p.nom} · ${formatDate(j.date)}`}
                    className={`h-9 w-9 cursor-pointer border-b border-b-border border-l p-0.5 text-center align-middle ${
                      j.estAujourdhui
                        ? "border-l-primary bg-primary/10"
                        : `border-l-border ${j.weekend || j.ferie ? "bg-secondary/60" : ""}`
                    }`}
                  >
                    {ev.length > 0 ? (
                      <div className="flex h-full w-full items-center justify-center gap-0.5 leading-none">
                        {nbEnc > 0 ? (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-semibold text-white ring-1 ring-emerald-700/30">
                            {nbEnc}
                          </span>
                        ) : null}
                        {nbDec > 0 ? (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ring-1 ring-rose-700/30">
                            {nbDec}
                          </span>
                        ) : null}
                        {nbJal > 0 ? (
                          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white ring-1 ring-amber-700/30">
                            {nbJal}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
          {lignesPlanning.map((ligne) => (
            <tr key={ligne.id}>
              <td className="sticky left-0 z-10 border-b border-border bg-card px-3 py-1 font-medium whitespace-nowrap">
                {ligne.nom}
              </td>
              {jours.map((j, index) => {
                const cellule = ligne.cellules[j.date];
                const selectionnee = dansSelection(ligne.id, index);
                return (
                  <td
                    key={j.date}
                    onMouseDown={() => {
                      setSelection({ freelanceId: ligne.id, debut: index, fin: index });
                      setGlisse(true);
                    }}
                    onMouseEnter={() => {
                      if (glisse && selection && selection.freelanceId === ligne.id) {
                        setSelection({ ...selection, fin: index });
                      }
                    }}
                    className={`h-9 w-9 cursor-pointer border-b border-b-border border-l p-0.5 text-center align-middle ${
                      j.estAujourdhui
                        ? "border-l-primary bg-primary/10"
                        : `border-l-border ${j.weekend || j.ferie ? "bg-secondary/60" : ""}`
                    } ${selectionnee ? "ring-2 ring-inset ring-primary" : ""}`}
                  >
                    {cellule ? (
                      <div
                        className="flex h-full w-full items-center justify-center overflow-hidden rounded-sm text-[10px] leading-none"
                        style={{ backgroundColor: cellule.couleur.bg, color: cellule.couleur.fg }}
                        title={`${cellule.missionNom} (client : ${cellule.clientNom})`}
                      >
                        {cellule.missionNom.slice(0, 3)}
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pop-up de sélection de mission */}
      <Dialog open={popup !== null} onOpenChange={(o) => (!o ? fermerPopup() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ligneActive?.nom}
              {popup && popup.dates.length > 0
                ? ` : ${popup.dates.length} jour${popup.dates.length > 1 ? "s" : ""}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          {/* Édition du TJM d'un seul jour déjà posé */}
          {celluleUnique ? (
            <EditeurTarifJour
              key={popup?.dates[0]}
              tarif={celluleUnique}
              onSave={enregistrerTarifJour}
            />
          ) : null}

          {ligneActive && ligneActive.missions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Affecter à la mission :</p>
              {ligneActive.missions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => choisirMission(m.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span
                    className="size-4 shrink-0 rounded-sm"
                    style={{ backgroundColor: m.couleur.bg }}
                  />
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium">{m.nom}</span>
                    <span className="text-xs text-muted-foreground">Client : {m.clientNom}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune mission disponible au planning pour ce freelance.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <MissionFormDialog
              action={creerMission}
              titre="Nouvelle mission"
              freelancesActifs={freelancesOptions}
              clientsListe={clientsActifs}
              freelanceIdInitial={popup?.freelanceId}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  Créer une mission
                </Button>
              }
              onCreated={(mission) => {
                setLignesPlanning((actuelles) => {
                  const ids = Array.from(
                    new Set([
                      ...actuelles.flatMap((ligne) => ligne.missions.map((m) => m.id)),
                      mission.id,
                    ])
                  ).sort((a, b) => a - b);
                  const couleur =
                    COULEURS_MISSION[ids.indexOf(mission.id) % COULEURS_MISSION.length];

                  return ajouterMissionPlanningLocal(
                    actuelles,
                    {
                      id: mission.id,
                      nom: mission.nom,
                      freelanceId: mission.freelanceId,
                      clientNom: mission.clientNom,
                    },
                    couleur
                  );
                });
              }}
            />
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm">
                  Libérer ces jours
                </Button>
              }
              titre="Libérer ces jours ?"
              description="Les affectations sélectionnées seront retirées du planning."
              confirmLabel="Libérer"
              destructif
              onConfirm={liberer}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Pop-up unique des événements d'un projet pour un jour (élargi) */}
      <Dialog
        open={popupProjet !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPopupProjet(null);
            setTypeAjout("");
            setFreelanceDecaissementId("");
          }
        }}
      >
        {/* min() : hauteur stable sur desktop, jamais plus haut que l'écran sur mobile. */}
        <DialogContent className="min-h-[min(34rem,calc(100dvh-2rem))] content-start sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {projetActif?.nom}
              {projetActif ? (
                <span className="text-muted-foreground"> · {projetActif.clientNom}</span>
              ) : null}
              {popupProjet ? ` · ${formatDate(popupProjet.date)}` : ""}
            </DialogTitle>
          </DialogHeader>

          {/* Événements déjà présents ce jour */}
          <div className="space-y-1">
            {evenementsJour.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Rien n’est encore prévu ni enregistré pour ce projet à cette date. Utilisez le
                bouton ci-dessous pour ajouter un encaissement, un décaissement ou un jalon.
              </p>
            ) : (
              evenementsJour.map((ev) => (
                <div
                  key={`${ev.type}-${ev.id}`}
                  className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      ev.type === "encaissement"
                        ? "bg-emerald-500"
                        : ev.type === "decaissement"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <span className="shrink-0 font-medium">
                    {ev.type === "encaissement"
                      ? "Encaissement"
                      : ev.type === "decaissement"
                        ? "Décaissement"
                        : "Jalon"}
                  </span>
                  {ev.freelanceNom ? (
                    <span className="shrink-0 text-muted-foreground">{ev.freelanceNom}</span>
                  ) : null}
                  <span className="flex-1 truncate text-muted-foreground">{ev.libelle ?? ""}</span>
                  {ev.montant !== null ? (
                    <span className="shrink-0 tabular-nums">{formatEuro(Number(ev.montant))}</span>
                  ) : null}
                  <button
                    onClick={() => supprimerEv(ev)}
                    className="shrink-0 text-muted-foreground hover:text-rose-600"
                    title="Supprimer"
                    aria-label="Supprimer"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Ajout d'un événement : bouton -> choix du type (intégré) -> formulaire.
              Choix intégré (et non un menu flottant) pour rester dans l'encart. */}
          <div className="space-y-3 border-t border-border pt-3">
            {typeAjout === "" ? (
              <Button size="sm" onClick={() => setTypeAjout("menu")}>
                Ajouter un événement
              </Button>
            ) : (
              <div className="space-y-1">
                <Label>Type d’événement</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    { value: "encaissement", label: "Encaissement", sous: "recette client" },
                    { value: "decaissement", label: "Décaissement", sous: "coût freelance" },
                    { value: "jalon", label: "Jalon", sous: "étape clé" },
                  ].map((opt) => {
                    const actif = typeAjout === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setTypeAjout(opt.value as "encaissement" | "decaissement" | "jalon")
                        }
                        className={`flex flex-col rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          actif
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.sous}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Budget : affiché une fois un type avec montant choisi */}
            {typeAjout === "encaissement" || typeAjout === "decaissement" ? (
              <p className="text-sm text-muted-foreground">
                Budget du projet :{" "}
                <span className="font-medium text-foreground">{formatEuro(budgetProjet)}</span>{" "}
                (montant maximum saisissable)
              </p>
            ) : null}

            {typeAjout === "encaissement" ? (
              <form action={ajouterEnc} className="space-y-3">
                <input type="hidden" name="projetId" value={String(popupProjet?.projetId ?? "")} />
                <input type="hidden" name="date" value={popupProjet?.date ?? ""} />
                <div className="space-y-1">
                  <Label htmlFor="enc-montant">Montant (€)</Label>
                  <Input
                    id="enc-montant"
                    name="montant"
                    type="number"
                    min="0"
                    max={budgetProjet}
                    step="1"
                    placeholder={`Max ${budgetProjet}`}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="enc-libelle">Libellé (optionnel)</Label>
                  <Input id="enc-libelle" name="libelle" placeholder="Ex : acompte, jalon 1…" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="enc-statut">Statut</Label>
                    <Select
                      id="enc-statut"
                      name="statut"
                      defaultValue="prevu"
                      options={[
                        { value: "prevu", label: "Prévu (à venir)" },
                        { value: "encaisse", label: "Encaissé (reçu)" },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="enc-fiab">Fiabilité % (si prévu)</Label>
                    <Input
                      id="enc-fiab"
                      name="fiabilite"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      defaultValue="100"
                      placeholder="0 à 100"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Ajouter l’encaissement
                </Button>
              </form>
            ) : null}

            {typeAjout === "decaissement" ? (
              <form action={ajouterDec} className="space-y-3">
                <input type="hidden" name="projetId" value={String(popupProjet?.projetId ?? "")} />
                <input type="hidden" name="date" value={popupProjet?.date ?? ""} />
                <div className="space-y-1">
                  <Label htmlFor="dec-freelance">Freelance</Label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Select
                      id="dec-freelance"
                      name="freelanceId"
                      required
                      value={freelanceDecaissementId}
                      onValueChange={setFreelanceDecaissementId}
                      placeholder="Choisir un freelance"
                      options={freelancesOptions.map((f) => ({
                        value: f.id,
                        label: `${f.prenom} ${f.nom}`,
                      }))}
                    />
                    <FreelanceFormDialog
                      action={creerFreelance}
                      titre="Nouveau freelance"
                      trigger={
                        <Button type="button" variant="outline">
                          Créer
                        </Button>
                      }
                      onCreated={(freelance) => {
                        const resultat = ajouterFreelanceLocal(freelancesOptions, freelance);
                        setFreelancesOptions(resultat.options);
                        setFreelanceDecaissementId(resultat.selectedId);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dec-montant">Montant (€)</Label>
                  <Input
                    id="dec-montant"
                    name="montant"
                    type="number"
                    min="0"
                    max={budgetProjet}
                    step="1"
                    placeholder={`Max ${budgetProjet}`}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dec-libelle">Libellé (optionnel)</Label>
                  <Input id="dec-libelle" name="libelle" placeholder="Ex : sprint 1…" />
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Ajouter le décaissement
                </Button>
              </form>
            ) : null}

            {typeAjout === "jalon" ? (
              <form action={ajouterJal} className="space-y-3">
                <input type="hidden" name="projetId" value={String(popupProjet?.projetId ?? "")} />
                <input type="hidden" name="date" value={popupProjet?.date ?? ""} />
                <div className="space-y-1">
                  <Label htmlFor="jal-libelle">Libellé</Label>
                  <Input id="jal-libelle" name="libelle" placeholder="Ex : Livraison V1, recette client…" required />
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Ajouter le jalon
                </Button>
              </form>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Petit formulaire d'édition du TJM d'un seul jour. Monté à neuf à chaque ouverture
// du pop-up (clé sur la date), donc l'état part toujours des bonnes valeurs.
function EditeurTarifJour({
  tarif,
  onSave,
}: {
  tarif: { tjmAchat: string; tjmVente: string };
  onSave: (tjmAchat: string, tjmVente: string) => void;
}) {
  const [tjmAchat, setTjmAchat] = useState(tarif.tjmAchat);
  const [tjmVente, setTjmVente] = useState(tarif.tjmVente);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(tjmAchat, tjmVente);
      }}
      className="space-y-3 rounded-lg border border-border p-3"
    >
      <p className="text-sm font-medium">Tarif de ce jour</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="cell-achat">TJM achat (€ HT)</Label>
          <Input
            id="cell-achat"
            type="number"
            min="0"
            step="1"
            value={tjmAchat}
            onChange={(e) => setTjmAchat(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cell-vente">TJM vente (€ HT)</Label>
          <Input
            id="cell-vente"
            type="number"
            min="0"
            step="1"
            value={tjmVente}
            onChange={(e) => setTjmVente(e.target.value)}
            required
          />
        </div>
      </div>
      <Button type="submit" size="sm">
        Enregistrer le tarif
      </Button>
    </form>
  );
}
