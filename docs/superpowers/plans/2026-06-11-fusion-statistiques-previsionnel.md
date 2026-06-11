# Fusion Statistiques Previsionnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one `/statistiques` pilotage page that shows realized months and forecast months in a shared chronological view, with the current month present in both blocks.

**Architecture:** Extract monthly financial aggregation into `src/app/statistiques/pilotage-calculs.ts` so status splitting is testable outside the server component. Rebuild `src/app/statistiques/page.tsx` around those helpers, preserve the existing filters, redirect `/previsionnel`, and simplify the sidebar.

**Tech Stack:** Next.js App Router, React server components, Drizzle ORM, shadcn-style local UI components, Vitest.

---

### Task 1: Pure Monthly Pilotage Calculations

**Files:**
- Create: `src/app/statistiques/pilotage-calculs.ts`
- Test: `src/app/statistiques/pilotage-calculs.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { calculerPilotageMensuel } from "./pilotage-calculs";

describe("calculerPilotageMensuel", () => {
  it("place le mois courant dans le réalisé et le prévisionnel selon le statut", () => {
    const resultat = calculerPilotageMensuel({
      debutPrevisionnel: "2026-06-01",
      finPrevisionnel: "2026-08-31",
      affectations: [{ date: "2026-06-12", tjmAchat: 500, tjmVente: 800 }],
      encaissements: [
        { date: "2026-06-10", montant: 1000, statut: "encaisse", fiabilite: null },
        { date: "2026-06-20", montant: 2000, statut: "prevu", fiabilite: "50" },
      ],
      decaissements: [
        { date: "2026-06-09", montant: 300, statut: "decaisse" },
        { date: "2026-06-25", montant: 400, statut: "prevu" },
      ],
    });

    expect(resultat.realise).toEqual([
      { cle: "2026-06", annee: 2026, mois: 6, ca: 1000, cout: 300, marge: 700, taux: 0.7 },
    ]);
    expect(resultat.previsionnel[0]).toMatchObject({
      cle: "2026-06",
      caMax: 2800,
      caProb: 1800,
      charges: 900,
      margeMax: 1900,
      margeProb: 900,
      cumulProb: 900,
    });
  });

  it("garde les mois futurs vides entre le mois courant et le dernier mois avec données", () => {
    const resultat = calculerPilotageMensuel({
      debutPrevisionnel: "2026-06-01",
      finPrevisionnel: "2026-09-30",
      affectations: [],
      encaissements: [{ date: "2026-09-05", montant: 1200, statut: "prevu", fiabilite: "100" }],
      decaissements: [],
    });

    expect(resultat.previsionnel.map((l) => l.cle)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run: `npm test -- src/app/statistiques/pilotage-calculs.test.ts`

Expected: FAIL because `./pilotage-calculs` does not exist.

- [ ] **Step 3: Implement the helper**

Create `pilotage-calculs.ts` with exported input types, `calculerPilotageMensuel`, and local month helpers. The helper must include realized rows for `encaisse` and `decaisse`, forecast rows for `prevu` and freelance affectations, and cumulative probable margin.

- [ ] **Step 4: Run the helper tests**

Run: `npm test -- src/app/statistiques/pilotage-calculs.test.ts`

Expected: PASS.

### Task 2: Rebuild `/statistiques` As Pilotage Page

**Files:**
- Modify: `src/app/statistiques/page.tsx`
- Reuse: `src/app/statistiques/stats-filtres.tsx`
- Reuse: `src/app/statistiques/stats-filtre-drawer.tsx`

- [ ] **Step 1: Replace page-level aggregation**

Use `calculerPilotageMensuel` after fetching:

```ts
const pilotage = calculerPilotageMensuel({
  debutPrevisionnel,
  finPrevisionnel,
  affectations: affs,
  encaissements: encs,
  decaissements: decs,
});
```

- [ ] **Step 2: Query realized and forecast data by status**

Fetch current and past realized project rows with `statut = "encaisse"` and `statut = "decaisse"`. Fetch forecast project rows with `statut = "prevu"`. Fetch freelance affectations only for the forecast window.

- [ ] **Step 3: Render one card with two tables**

The realized table columns are `Mois`, `CA encaissé`, `Coûts décaissés`, `Marge réalisée`, `Taux`. The forecast table columns are `Mois`, `CA max`, `CA probable`, `Charges prévues`, `Marge max`, `Marge probable`, `Cumul probable`.

- [ ] **Step 4: Keep the month current in both blocks**

Use the date windows from the spec: predefined period is symmetric around today, custom range uses the selected range for realized and current-month-to-selected-end for forecast.

### Task 3: Navigation and Redirect

**Files:**
- Modify: `src/app/sidebar.tsx`
- Replace: `src/app/previsionnel/page.tsx`

- [ ] **Step 1: Update sidebar links**

Remove the `/previsionnel` link and rename `/statistiques` to `Pilotage`.

- [ ] **Step 2: Redirect old forecast route**

Replace `/previsionnel` with a redirect that preserves query parameters:

```ts
import { redirect } from "next/navigation";

export default async function PagePrevisionnel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cible = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) cible.append(key, item);
    } else if (value) {
      cible.set(key, value);
    }
  }
  redirect(`/statistiques${cible.size ? `?${cible.toString()}` : ""}`);
}
```

### Task 4: Verification

**Files:**
- Verify: all changed files

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/app/statistiques/pilotage-calculs.test.ts`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run: `git diff origin/main...`

Expected: only the design doc, plan doc, pilotage helper/tests, statistics page, redirect page, and sidebar changes are present.
