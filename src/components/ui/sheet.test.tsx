import { describe, expect, test } from "vitest";

import { getSheetContentClassName } from "./sheet";

describe("SheetContent", () => {
  test("utilise une largeur de drawer agrandie et uniforme", () => {
    const className = getSheetContentClassName("max-w-md");

    expect(className).toContain("max-w-2xl");
    expect(className).not.toContain("max-w-md");
  });

  test("panneau gauche : positionnement et largeur de navigation mobile", () => {
    const className = getSheetContentClassName("gap-0 p-0", "left");

    expect(className).toContain("left-0");
    expect(className).toContain("max-w-72");
    expect(className).toContain("slide-in-from-left");
    expect(className).not.toContain("max-w-2xl");
    expect(className).not.toContain("right-0");
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
