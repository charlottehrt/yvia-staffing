import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { IndicateursPrevisionnel } from "./indicateurs-previsionnel";

describe("IndicateursPrevisionnel", () => {
  test("affiche les encarts CA et marge cumulés du prévisionnel", () => {
    const html = renderToStaticMarkup(
      <IndicateursPrevisionnel
        totalCaMax={12345}
        totalCaProb={9876}
        totalMargeMax={4321}
        totalMargeProb={2109}
      />
    );

    expect(html).toContain("CA max (cumulé)");
    expect(html).toContain("CA probable (cumulé)");
    expect(html).toContain("Marge maximum (cumulée)");
    expect(html).toContain("Marge probable (cumulée)");
    expect(html).toContain("lg:grid-cols-4");
  });
});
