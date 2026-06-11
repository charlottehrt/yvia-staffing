import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("configuration multi-worktree", () => {
  it("démarre Next sur le port réservé au workspace sans argument Conductor dédié", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts.dev).toBe("next dev -p ${PORT:-${CONDUCTOR_PORT:-3000}}");
    expect(packageJson.scripts.start).toBe("next start -p ${PORT:-${CONDUCTOR_PORT:-3000}}");
  });

  it("laisse le script npm choisir le port applicatif dans Conductor", () => {
    const settings = readFileSync(".conductor/settings.toml", "utf8");

    expect(settings).toContain('run = "npm run dev"');
    expect(settings).toContain('run_mode = "concurrent"');
  });
});
