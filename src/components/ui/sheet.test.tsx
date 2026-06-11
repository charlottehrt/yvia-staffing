import { describe, expect, test } from "vitest";

import { getSheetContentClassName } from "./sheet";

describe("SheetContent", () => {
  test("utilise une largeur de drawer agrandie et uniforme", () => {
    const className = getSheetContentClassName("max-w-md");

    expect(className).toContain("max-w-2xl");
    expect(className).not.toContain("max-w-md");
  });

  test("préserve les className fonctionnels de Base UI", () => {
    const className = getSheetContentClassName(() => "max-w-md opacity-100");

    expect(typeof className).toBe("function");

    const resolvedClassName =
      typeof className === "function" ? className({} as never) : className;

    expect(resolvedClassName).toContain("max-w-2xl");
    expect(resolvedClassName).toContain("opacity-100");
    expect(resolvedClassName).not.toContain("max-w-md");
  });
});
