import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("configuration multi-worktree", () => {
  it("démarre Next sur le port réservé au workspace sans argument Conductor dédié", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts.dev).toBe(
      "NODE_ENV=development next dev -p ${PORT:-${CONDUCTOR_PORT:-3000}}"
    );
    expect(packageJson.scripts.start).toBe("next start -p ${PORT:-${CONDUCTOR_PORT:-3000}}");
  });

  it("laisse le script npm choisir le port applicatif dans Conductor", () => {
    const settings = readFileSync(".conductor/settings.toml", "utf8");

    expect(settings).toContain('run = "npm run dev"');
    expect(settings).toContain('run_mode = "concurrent"');
  });

  it("branche Hecaton sur la base isolée du workspace", () => {
    const hecaton = JSON.parse(readFileSync("hecaton.json", "utf8"));

    expect(hecaton.env.DATABASE_URL).toBe("${HECATON_DATABASE_URL}");
    expect(hecaton.env.DATABASE_URL_UNPOOLED).toBe("${HECATON_DATABASE_URL}");
    expect(hecaton.env.NODE_ENV).toBe("development");
  });
});
