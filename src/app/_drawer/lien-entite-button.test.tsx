import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("./actions", () => ({
  chargerEntite: vi.fn(),
  basculerActif: vi.fn(),
  modifierChampEntite: vi.fn(),
}));

import { LienEntiteButton } from "./drawer-stack";

describe("LienEntiteButton", () => {
  test("affiche le statut actif d'une mission liee", () => {
    const html = renderToStaticMarkup(
      <LienEntiteButton
        lien={{
          ref: { type: "mission", id: 12 },
          label: "Refonte CRM",
          sous: "Ada Lovelace",
          statut: { actif: true, label: "Active" },
        }}
        onOuvrir={vi.fn()}
      />
    );

    expect(html).toContain("Refonte CRM");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Active");
  });

  test("grise une mission liee inactive", () => {
    const html = renderToStaticMarkup(
      <LienEntiteButton
        lien={{
          ref: { type: "mission", id: 13 },
          label: "Audit legacy",
          sous: "Grace Hopper",
          statut: { actif: false, label: "Inactive" },
        }}
        onOuvrir={vi.fn()}
      />
    );

    expect(html).toContain("Inactive");
    expect(html).toContain("bg-muted/40");
    expect(html).toContain("text-muted-foreground");
  });
});
