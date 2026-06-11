import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/_drawer/drawer-stack", () => ({
  useDrawer: () => ({ ouvrir: () => undefined }),
}));

import { ClientRowView } from "./client-row";

type RowElement = ReactElement<{
  className?: string;
  onClick?: () => void;
}>;

describe("ClientRow", () => {
  const stats = {
    caTotal: 12000,
    caMois: 3500,
    margeTotale: 4200,
  };

  test("ouvre le detail client quand toute la ligne est cliquée", () => {
    const ouvrir = vi.fn();
    const row = ClientRowView({ id: 7, nom: "Wenimmo", ...stats, onOpen: ouvrir }) as RowElement;

    expect(row.props.className).toContain("cursor-pointer");
    row.props.onClick?.();

    expect(ouvrir).toHaveBeenCalledWith({ type: "client", id: 7 });
  });

  test("rend le nom du client dans la ligne", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ClientRowView id={7} nom="Wenimmo" {...stats} onOpen={() => {}} />
        </tbody>
      </table>
    );

    expect(html).toContain("<tr");
    expect(html).toContain("Wenimmo");
  });

  test("rend les indicateurs financiers du client", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <ClientRowView id={7} nom="Wenimmo" {...stats} onOpen={() => {}} />
        </tbody>
      </table>
    );

    expect(html).toContain("12");
    expect(html).toContain("000");
    expect(html).toContain("3");
    expect(html).toContain("500");
    expect(html).toContain("4");
    expect(html).toContain("200");
  });
});
