# Creation D'entites Depuis Les Popups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create missing clients, freelances, and missions from the popup they are already using, then select the created value automatically.

**Architecture:** Add small pure helpers for local option insertion and selection. Extend creation server actions to return created entities. Make parent dialogs own the relevant select state and open existing creation dialogs as child dialogs with `onCreated` callbacks.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Base UI dialogs/selects, Drizzle server actions, Vitest.

---

### Task 1: Local Entity Option Helpers

**Files:**
- Create: `src/lib/entity-options.ts`
- Create: `src/lib/entity-options.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, test } from "vitest";
import {
  ajouterClientLocal,
  ajouterFreelanceLocal,
  ajouterMissionPlanningLocal,
} from "./entity-options";

describe("entity option helpers", () => {
  test("ajoute un client sans doublon et selectionne son id", () => {
    const resultat = ajouterClientLocal(
      [{ id: 1, nom: "Acme" }],
      { id: 2, nom: "Beta" }
    );

    expect(resultat.options).toEqual([
      { id: 1, nom: "Acme" },
      { id: 2, nom: "Beta" },
    ]);
    expect(resultat.selectedId).toBe("2");
  });

  test("ne duplique pas un freelance deja present", () => {
    const resultat = ajouterFreelanceLocal(
      [{ id: 1, prenom: "Ada", nom: "Lovelace" }],
      { id: 1, prenom: "Ada", nom: "Lovelace" }
    );

    expect(resultat.options).toEqual([{ id: 1, prenom: "Ada", nom: "Lovelace" }]);
    expect(resultat.selectedId).toBe("1");
  });

  test("ajoute une mission au bon freelance dans le planning", () => {
    const lignes = [
      { id: 7, nom: "Ada Lovelace", missions: [], cellules: {} },
      { id: 8, nom: "Grace Hopper", missions: [], cellules: {} },
    ];

    const resultat = ajouterMissionPlanningLocal(lignes, {
      id: 12,
      nom: "Audit",
      freelanceId: 7,
      clientNom: "Acme",
    });

    expect(resultat[0].missions).toEqual([
      { id: 12, nom: "Audit", clientNom: "Acme", couleur: expect.any(Object) },
    ]);
    expect(resultat[1].missions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/entity-options.test.ts`

Expected: FAIL because `src/lib/entity-options.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

```ts
export type ClientOptionLocal = { id: number; nom: string };
export type FreelanceOptionLocal = { id: number; prenom: string; nom: string };
export type MissionPlanningLocal = {
  id: number;
  nom: string;
  freelanceId: number;
  clientNom: string;
};

function ajouterUniqueParId<T extends { id: number }>(options: T[], item: T): T[] {
  return options.some((option) => option.id === item.id) ? options : [...options, item];
}

export function ajouterClientLocal(options: ClientOptionLocal[], client: ClientOptionLocal) {
  return { options: ajouterUniqueParId(options, client), selectedId: String(client.id) };
}

export function ajouterFreelanceLocal(
  options: FreelanceOptionLocal[],
  freelance: FreelanceOptionLocal
) {
  return { options: ajouterUniqueParId(options, freelance), selectedId: String(freelance.id) };
}

export function ajouterMissionPlanningLocal<
  T extends {
    id: number;
    missions: Array<{ id: number; nom: string; clientNom: string; couleur: unknown }>;
  },
>(
  lignes: T[],
  mission: MissionPlanningLocal,
  couleur: unknown = { bg: "#0571ed", fg: "#ffffff" }
): T[] {
  return lignes.map((ligne) =>
    ligne.id === mission.freelanceId
      ? {
          ...ligne,
          missions: ligne.missions.some((m) => m.id === mission.id)
            ? ligne.missions
            : [
                ...ligne.missions,
                {
                  id: mission.id,
                  nom: mission.nom,
                  clientNom: mission.clientNom,
                  couleur,
                },
              ],
        }
      : ligne
  );
}
```

- [ ] **Step 4: Run the helper tests**

Run: `npm test -- src/lib/entity-options.test.ts`

Expected: PASS.

### Task 2: Server Actions Return Created Entities

**Files:**
- Modify: `src/app/clients/actions.ts`
- Modify: `src/app/freelances/actions.ts`
- Modify: `src/app/missions/actions.ts`
- Modify: `src/app/projets/actions.ts`

- [ ] **Step 1: Update action result types and inserts**

Change each creation action to use `.returning(...)` and return the created entity:

```ts
const [client] = await db.insert(clients).values({ nom }).returning({ id: clients.id, nom: clients.nom });
return { ok: true, client };
```

Use the same pattern for freelances and missions. Mission creation must return `id`, `nom`, `freelanceId`, `clientId`, `tjmAchat`, and `tjmVente`. Project creation can keep returning `{ ok: true }` because no parent select consumes newly created projects.

- [ ] **Step 2: Run TypeScript/lint feedback**

Run: `npm run lint`

Expected: no TypeScript or ESLint errors from changed action signatures.

### Task 3: Child Dialog Callbacks

**Files:**
- Modify: `src/app/clients/client-form-dialog.tsx`
- Modify: `src/app/freelances/freelance-form-dialog.tsx`
- Modify: `src/app/missions/mission-form-dialog.tsx`

- [ ] **Step 1: Add optional `onCreated` props**

Each dialog accepts `onCreated?: (entity) => void`. In the success branch, call it only when the dialog is in creation mode and the action result contains the expected entity.

```tsx
if (res.ok) {
  if (!client && "client" in res && res.client) onCreated?.(res.client);
  toast.success("Client enregistré.");
  setOpen(false);
}
```

Use equivalent checks for `freelance` and `mission`.

- [ ] **Step 2: Keep existing usages working**

Do not make `trigger`, `titre`, `action`, or existing list props optional. Existing top-level pages must still compile without passing `onCreated`.

### Task 4: Parent Dialog Select State And Create Buttons

**Files:**
- Modify: `src/app/projets/projet-form-dialog.tsx`
- Modify: `src/app/missions/mission-form-dialog.tsx`
- Modify: `src/app/projets/projet-detail-dialog.tsx`
- Modify: `src/app/planning-calendar.tsx`

- [ ] **Step 1: Make entity lists local state**

In each parent client component, initialize local state from server props:

```tsx
const [clientsOptions, setClientsOptions] = useState(clientsListe);
const [clientId, setClientId] = useState(projet?.clientId ? String(projet.clientId) : "");
```

Use equivalent state for freelances.

- [ ] **Step 2: Add adjacent create buttons**

Render select plus `Créer` button in a two-column layout:

```tsx
<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
  <Select value={clientId} onValueChange={setClientId} name="clientId" required options={...} />
  <ClientFormDialog action={creerClient} titre="Nouveau client" trigger={<Button type="button" variant="outline">Créer</Button>} onCreated={...} />
</div>
```

Use existing dialog components for client, freelance, and mission creation.

- [ ] **Step 3: Select created entities automatically**

Use the helpers from Task 1 inside `onCreated`:

```tsx
const resultat = ajouterClientLocal(clientsOptions, client);
setClientsOptions(resultat.options);
setClientId(resultat.selectedId);
```

Apply equivalent logic for freelances and planning missions.

### Task 5: Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: all Vitest tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: no ESLint or TypeScript errors.

- [ ] **Step 3: Manual UI smoke test**

Run: `npm run dev` and open the app locally. Check that a `Créer` button appears next to entity selects in project, mission, project detail cost, and planning popups.
