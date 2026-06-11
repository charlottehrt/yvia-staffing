import type { ReactElement } from "react";
import { Children } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/_drawer/drawer-stack", () => ({
  useDrawer: () => ({ ouvrir: () => undefined }),
}));

// Les actions importent @/db (qui exige DATABASE_URL à l'import) : on les mocke.
vi.mock("./actions", () => ({
  basculerAfficherPlanning: vi.fn(),
}));

import { FreelanceRowView } from "./freelance-row";

type RowElement = ReactElement<{
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}>;

type CellElement = ReactElement<{
  onClick?: (e: { stopPropagation: () => void }) => void;
}>;

describe("FreelanceRow", () => {
  test("ouvre le détail freelance quand toute la ligne est cliquée", () => {
    const ouvrir = vi.fn();
    const row = FreelanceRowView({
      id: 7,
      nom: "Ada Lovelace",
      gain: 1200,
      onOpen: ouvrir,
    }) as RowElement;

    expect(row.props.className).toContain("cursor-pointer");
    row.props.onClick?.();

    expect(ouvrir).toHaveBeenCalledWith({ type: "freelance", id: 7 });
  });

  test("rend le nom et le gain du freelance", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <FreelanceRowView id={7} nom="Ada Lovelace" gain={1200} onOpen={() => {}} />
        </tbody>
      </table>
    );

    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("200");
  });

  test("rend l'interrupteur planning coché quand le freelance est affiché", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <FreelanceRowView
            id={7}
            nom="Ada Lovelace"
            gain={0}
            afficherPlanning={true}
            onOpen={() => {}}
            onTogglePlanning={() => {}}
          />
        </tbody>
      </table>
    );

    expect(html).toContain("Afficher dans le planning");
    expect(html).toContain("aria-checked=\"true\"");
  });

  test("rend l'interrupteur planning décoché quand le freelance est masqué", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <FreelanceRowView
            id={7}
            nom="Ada Lovelace"
            gain={0}
            afficherPlanning={false}
            onOpen={() => {}}
            onTogglePlanning={() => {}}
          />
        </tbody>
      </table>
    );

    expect(html).toContain("aria-checked=\"false\"");
  });

  test("pas d'interrupteur quand la visibilité n'est pas fournie (vue archives)", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <FreelanceRowView id={7} nom="Ada Lovelace" gain={0} onOpen={() => {}} />
        </tbody>
      </table>
    );

    expect(html).not.toContain("Afficher dans le planning");
  });

  test("le clic sur la cellule planning n'ouvre pas le drawer", () => {
    const ouvrir = vi.fn();
    const row = FreelanceRowView({
      id: 7,
      nom: "Ada Lovelace",
      gain: 0,
      afficherPlanning: true,
      onOpen: ouvrir,
      onTogglePlanning: () => {},
    }) as RowElement;

    const cellules = Children.toArray(row.props.children) as CellElement[];
    const cellulePlanning = cellules[cellules.length - 1];
    const stopPropagation = vi.fn();
    cellulePlanning.props.onClick?.({ stopPropagation });

    expect(stopPropagation).toHaveBeenCalled();
    expect(ouvrir).not.toHaveBeenCalled();
  });
});
