import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { ListViewToolbar } from "./list-view-toolbar";

describe("ListViewToolbar", () => {
  test("places filters and action on the same responsive row", () => {
    const html = renderToStaticMarkup(
      <ListViewToolbar
        action={<button type="button">Nouvelle mission</button>}
      >
        <a href="/missions">Actives</a>
        <a href="/missions?statut=inactives">Inactives</a>
      </ListViewToolbar>
    );

    expect(html).toContain("sm:flex-row");
    expect(html).toContain("sm:items-center");
    expect(html).toContain("sm:justify-between");
    expect(html).toContain("sm:ml-auto");
    expect(html.indexOf("Actives")).toBeLessThan(html.indexOf("Nouvelle mission"));
  });
});
