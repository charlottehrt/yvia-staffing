# Projets CRM Simple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple commercial status and estimated amount to existing projects, while treating lost and completed projects as out of the active business flow.

**Architecture:** Keep the existing `projets` table as the only domain object. Centralize project commercial status labels and active/completed classification in one small library module, then use that helper from pages and server actions. Add a versioned Drizzle migration with targeted `ALTER TABLE` SQL suitable for an existing Neon production database.

**Tech Stack:** Next.js App Router, React 19, Drizzle ORM/Kit, PostgreSQL/Neon, Vitest, shadcn/Base UI components.

---

### Task 1: Project Status Domain Helper

**Files:**
- Create: `src/lib/projets/statut-commercial.ts`
- Test: `src/lib/projets/statut-commercial.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/projets/statut-commercial.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  estProjetDansFluxActif,
  estProjetTermineOuPerdu,
  labelStatutCommercial,
  normaliserStatutCommercial,
} from "./statut-commercial";

describe("statut commercial projet", () => {
  test("normalise les valeurs inconnues vers a_qualifier", () => {
    expect(normaliserStatutCommercial("en_discussion")).toBe("en_discussion");
    expect(normaliserStatutCommercial("")).toBe("a_qualifier");
    expect(normaliserStatutCommercial("ancien-statut")).toBe("a_qualifier");
    expect(normaliserStatutCommercial(null)).toBe("a_qualifier");
  });

  test("expose les libelles affichables", () => {
    expect(labelStatutCommercial("a_qualifier")).toBe("A qualifier");
    expect(labelStatutCommercial("proposition_envoyee")).toBe("Proposition envoyee");
    expect(labelStatutCommercial("perdu")).toBe("Perdu");
  });

  test("classe les projets actifs hors perdu dans le flux actif", () => {
    expect(estProjetDansFluxActif({ actif: true, statutCommercial: "gagne" })).toBe(true);
    expect(estProjetDansFluxActif({ actif: true, statutCommercial: "a_qualifier" })).toBe(true);
    expect(estProjetDansFluxActif({ actif: true, statutCommercial: "perdu" })).toBe(false);
    expect(estProjetDansFluxActif({ actif: false, statutCommercial: "gagne" })).toBe(false);
  });

  test("classe les projets termines ou perdus ensemble", () => {
    expect(estProjetTermineOuPerdu({ actif: false, statutCommercial: "gagne" })).toBe(true);
    expect(estProjetTermineOuPerdu({ actif: true, statutCommercial: "perdu" })).toBe(true);
    expect(estProjetTermineOuPerdu({ actif: false, statutCommercial: "perdu" })).toBe(true);
    expect(estProjetTermineOuPerdu({ actif: true, statutCommercial: "en_discussion" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- src/lib/projets/statut-commercial.test.ts
```

Expected: FAIL because `src/lib/projets/statut-commercial.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/projets/statut-commercial.ts`:

```ts
export const STATUTS_COMMERCIAUX = [
  { key: "a_qualifier", label: "A qualifier" },
  { key: "en_discussion", label: "En discussion" },
  { key: "proposition_envoyee", label: "Proposition envoyee" },
  { key: "gagne", label: "Gagne" },
  { key: "perdu", label: "Perdu" },
] as const;

export type StatutCommercialProjet = (typeof STATUTS_COMMERCIAUX)[number]["key"];

const STATUTS = new Set<string>(STATUTS_COMMERCIAUX.map((s) => s.key));
const LABELS = new Map<StatutCommercialProjet, string>(
  STATUTS_COMMERCIAUX.map((s) => [s.key, s.label])
);

export const STATUT_COMMERCIAL_DEFAUT: StatutCommercialProjet = "a_qualifier";
export const STATUT_COMMERCIAL_EXISTANT: StatutCommercialProjet = "gagne";

export function normaliserStatutCommercial(
  statut: string | null | undefined
): StatutCommercialProjet {
  return STATUTS.has(statut ?? "")
    ? (statut as StatutCommercialProjet)
    : STATUT_COMMERCIAL_DEFAUT;
}

export function labelStatutCommercial(statut: string | null | undefined): string {
  return LABELS.get(normaliserStatutCommercial(statut)) ?? statut ?? "";
}

export function estProjetDansFluxActif(projet: {
  actif: boolean;
  statutCommercial: string | null;
}): boolean {
  return projet.actif && normaliserStatutCommercial(projet.statutCommercial) !== "perdu";
}

export function estProjetTermineOuPerdu(projet: {
  actif: boolean;
  statutCommercial: string | null;
}): boolean {
  return !projet.actif || normaliserStatutCommercial(projet.statutCommercial) === "perdu";
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run:

```bash
npm test -- src/lib/projets/statut-commercial.test.ts
```

Expected: PASS.

### Task 2: Schema and Migration

**Files:**
- Modify: `src/db/schema.ts`
- Create/Modify: `drizzle/*_projets_crm_simple.sql`
- Create/Modify: `drizzle/meta/_journal.json`

- [ ] **Step 1: Add schema fields**

Modify `src/db/schema.ts` in the `projets` table:

```ts
  // Suivi CRM simple du sujet commercial.
  // Les projets existants en production seront migrés en "gagne".
  statutCommercial: text("statut_commercial").notNull().default("a_qualifier"),
  montantEnvisage: numeric("montant_envisage", { precision: 12, scale: 2 }),
```

- [ ] **Step 2: Generate a versioned migration scaffold**

Run:

```bash
npx drizzle-kit generate --name=projets_crm_simple
```

Expected: creates a first migration under `drizzle/`. Because this repo did not previously version migrations, the generated SQL may contain full `CREATE TABLE` statements.

- [ ] **Step 3: Replace generated SQL with an existing-database safe migration**

Replace the generated SQL file contents with:

```sql
ALTER TABLE "projets"
  ADD COLUMN IF NOT EXISTS "statut_commercial" text;

UPDATE "projets"
SET "statut_commercial" = 'gagne'
WHERE "statut_commercial" IS NULL;

ALTER TABLE "projets"
  ALTER COLUMN "statut_commercial" SET DEFAULT 'a_qualifier';

ALTER TABLE "projets"
  ALTER COLUMN "statut_commercial" SET NOT NULL;

ALTER TABLE "projets"
  ADD COLUMN IF NOT EXISTS "montant_envisage" numeric(12, 2);
```

This preserves existing Neon data and avoids trying to recreate existing tables.

### Task 3: Project Mutations

**Files:**
- Modify: `src/app/projets/actions.ts`
- Modify: `src/app/_drawer/actions.ts`

- [ ] **Step 1: Validate and persist CRM fields in project create/update**

In `src/app/projets/actions.ts`, import:

```ts
import { normaliserStatutCommercial } from "@/lib/projets/statut-commercial";
```

Add a helper:

```ts
function lireMontantEnvisage(formData: FormData): string | null {
  const brut = String(formData.get("montantEnvisage") ?? "").trim();
  if (brut === "") return null;
  const n = Number(brut);
  return Number.isFinite(n) && n >= 0 ? String(n) : "__INVALIDE__";
}
```

In `creerProjet` and `modifierProjet`, read:

```ts
  const statutCommercial = normaliserStatutCommercial(
    String(formData.get("statutCommercial") ?? "")
  );
  const montantEnvisage = lireMontantEnvisage(formData);
  if (montantEnvisage === "__INVALIDE__") {
    return { ok: false, message: "Le montant envisage doit etre positif." };
  }
```

Persist:

```ts
await db.insert(projets).values({ clientId, nom, budget, statutCommercial, montantEnvisage });
```

and:

```ts
await db
  .update(projets)
  .set({ clientId, nom, budget, statutCommercial, montantEnvisage })
  .where(eq(projets.id, id));
```

- [ ] **Step 2: Allow inline drawer edits**

In `src/app/_drawer/actions.ts`, import:

```ts
import { normaliserStatutCommercial } from "@/lib/projets/statut-commercial";
```

Extend the project branch in `modifierChampEntite`:

```ts
    } else if (cle === "montantEnvisage") {
      if (v === "") {
        await db.update(projets).set({ montantEnvisage: null }).where(eq(projets.id, ref.id));
      } else {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return { ok: false, message: "Montant invalide." };
        await db.update(projets).set({ montantEnvisage: String(n) }).where(eq(projets.id, ref.id));
      }
    } else if (cle === "statutCommercial") {
      await db
        .update(projets)
        .set({ statutCommercial: normaliserStatutCommercial(v) })
        .where(eq(projets.id, ref.id));
```

### Task 4: Project UI

**Files:**
- Modify: `src/app/projets/page.tsx`
- Modify: `src/app/projets/projet-row.tsx`
- Modify: `src/app/projets/projet-form-dialog.tsx`
- Modify: `src/app/projets/projet-detail-dialog.tsx`
- Modify: `src/app/projets/archive-projet-button.tsx`

- [ ] **Step 1: Filter active vs completed/lost projects**

In `src/app/projets/page.tsx`, use `vue=termines`. Active list query must be:

```ts
.where(and(eq(projets.actif, true), ne(projets.statutCommercial, "perdu")))
```

Completed list query must be:

```ts
.where(or(eq(projets.actif, false), eq(projets.statutCommercial, "perdu")))
```

Also accept old `vue=archives` as completed for backward compatibility.

- [ ] **Step 2: Rename archive UI to completed**

In project page tabs, replace `Archives` with `Termines` and links with `/projets?vue=termines`.

In `src/app/projets/archive-projet-button.tsx`, keep the filename but change user-facing labels to:

- `Terminer`
- `Reouvrir`
- `Projet termine.`
- `Projet rouvert.`
- dialog title `Terminer ce projet ?`
- dialog description `Il n'apparaitra plus dans les listes actives. Vous pourrez le retrouver depuis l'onglet Termines.`

- [ ] **Step 3: Show status and estimated amount**

In `src/app/projets/page.tsx`, select `statutCommercial` and `montantEnvisage`, add table columns `Statut` and `Montant envisage`, and pass both fields to `ProjetRow`.

In `src/app/projets/projet-row.tsx`, display:

```tsx
<TableCell>{labelStatutCommercial(projet.statutCommercial)}</TableCell>
<TableCell className="text-right">
  {projet.montantEnvisage ? formatEuro(Number(projet.montantEnvisage)) : "-"}
</TableCell>
```

- [ ] **Step 4: Add fields to creation dialog**

In `src/app/projets/projet-form-dialog.tsx`, import `STATUTS_COMMERCIAUX`, add status select and estimated amount input:

```tsx
<Select
  id="statutCommercial"
  name="statutCommercial"
  defaultValue={projet?.statutCommercial ?? "a_qualifier"}
  options={STATUTS_COMMERCIAUX.map((s) => ({ value: s.key, label: s.label }))}
/>

<Input
  id="montantEnvisage"
  name="montantEnvisage"
  type="number"
  min="0"
  step="1"
  defaultValue={projet?.montantEnvisage ?? ""}
/>
```

- [ ] **Step 5: Add fields to detail sheet**

In `src/app/projets/projet-detail-dialog.tsx`, add `ChampInline` for `montantEnvisage` and a `Select` for `statutCommercial`, saving with `modifierChampEntite`.

### Task 5: Exclude Lost Projects from Other Active Surfaces

**Files:**
- Modify: `src/app/_drawer/actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/previsionnel/page.tsx`
- Modify: `src/app/statistiques/page.tsx`

- [ ] **Step 1: Client drawer**

In `chargerClient`, filter `projetsRows` with:

```ts
.where(and(eq(projets.clientId, id), eq(projets.actif, true), ne(projets.statutCommercial, "perdu")))
```

- [ ] **Step 2: Planning page**

In `src/app/page.tsx`, filter `projetsActifs` with `actif=true` and `statutCommercial != perdu`. Join project rows into encaissements, decaissements, and jalons queries or filter their project ids so lost projects do not contribute to active planning surfaces.

- [ ] **Step 3: Previsionnel page**

In forfait encaissement and decaissement queries, add `eq(projets.actif, true)` and `ne(projets.statutCommercial, "perdu")`.

- [ ] **Step 4: Statistiques page**

In forfait encaissement and decaissement queries, add `eq(projets.actif, true)` and `ne(projets.statutCommercial, "perdu")`.

### Task 6: Verification

**Files:**
- All touched files

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
npm test -- src/lib/projets/statut-commercial.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Validate migration SQL shape**

Run:

```bash
rg -n "ALTER TABLE \"projets\"|statut_commercial|montant_envisage|CREATE TABLE" drizzle
```

Expected: finds the targeted `ALTER TABLE` statements and no `CREATE TABLE` in the CRM migration SQL.

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: PASS.

---

## Self-Review

- Spec coverage: project status, estimated amount, no opportunities table, Termines view, lost-project exclusion, and Neon migration are covered.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: the plan uses `statutCommercial`/`montantEnvisage` in TypeScript and `statut_commercial`/`montant_envisage` in SQL.
