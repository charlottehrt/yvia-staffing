import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/app/_drawer/drawer-stack", () => ({
  EntityLink: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useDrawer: () => ({ ouvrir: () => undefined }),
}));

import { MissionRow, type LigneMission } from "./mission-row";

describe("missions table columns", () => {
  test("declares one header for each rendered mission cell", () => {
    const pagePath = fileURLToPath(new URL("./page.tsx", import.meta.url));
    const pageSource = readFileSync(pagePath, "utf8");
    const headerCount = pageSource.match(/<TableHead(?:\s|>)/g)?.length ?? 0;

    const mission: LigneMission = {
      id: 1,
      nom: "Delta Jules Perso",
      freelanceId: 1,
      clientId: 1,
      freelancePrenom: "Jules",
      freelanceNom: "Bertrand",
      clientNom: "DeltaRM",
      tjmAchat: "600",
      tjmVente: "600",
      actif: true,
    };

    const rowHtml = renderToStaticMarkup(
      <table>
        <tbody>
          <MissionRow l={mission} />
        </tbody>
      </table>
    );
    const cellCount = rowHtml.match(/<td(?:\s|>)/g)?.length ?? 0;

    expect(headerCount).toBe(cellCount);
  });
});
