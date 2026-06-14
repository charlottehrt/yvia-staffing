import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

function writeExecutable(path: string, contents: string) {
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
}

function envWithoutConductor() {
  const env = { ...process.env };
  delete env.CONDUCTOR_PORT;
  delete env.CONDUCTOR_WORKSPACE_NAME;
  delete env.HECATON_DB;
  delete env.HECATON_DATABASE_URL;
  return env;
}

function prepareProject(label: string, envContents = "") {
  const projectDir = mkdtempSync(join(tmpdir(), `worktree-down-${label}-`));
  tempDirs.push(projectDir);
  mkdirSync(join(projectDir, "scripts"));
  mkdirSync(join(projectDir, "bin"));

  writeFileSync(
    join(projectDir, "scripts", "worktree-down.sh"),
    readFileSync(join(import.meta.dirname, "worktree-down.sh"), "utf8")
  );
  chmodSync(join(projectDir, "scripts", "worktree-down.sh"), 0o755);
  writeFileSync(join(projectDir, ".env"), envContents);

  return projectDir;
}

describe("scripts/worktree-down.sh", () => {
  it("supprime la base Hecaton avec --purge sans appeler Docker", () => {
    const projectDir = prepareProject("hecaton");
    const nodeLog = join(projectDir, "node.log");

    writeExecutable(
      join(projectDir, "bin", "docker"),
      `#!/usr/bin/env bash
echo "docker should not run" >&2
exit 99
`
    );
    writeExecutable(
      join(projectDir, "bin", "node"),
      `#!/usr/bin/env bash
echo "$*" >> "${nodeLog}"
exit 0
`
    );

    const result = spawnSync("bash", ["scripts/worktree-down.sh", "--purge"], {
      cwd: projectDir,
      encoding: "utf8",
      env: {
        ...process.env,
        HECATON_DB: "delta_test",
        HECATON_DATABASE_URL: "postgresql://user:pass@postgres:5432/delta_test",
        PATH: `${join(projectDir, "bin")}:${process.env.PATH ?? ""}`,
      },
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("Suppression de la base Hecaton 'delta_test'");
    expect(readFileSync(nodeLog, "utf8")).toContain("scripts/hecaton-db.mjs down");
  });

  it("réutilise le port PostgreSQL enregistré dans .env", () => {
    const projectDir = prepareProject("port", 'DB_PORT="6123"\n');
    const dockerLog = join(projectDir, "docker.log");

    writeExecutable(
      join(projectDir, "bin", "docker"),
      `#!/usr/bin/env bash
echo "$* DB_PORT=$DB_PORT COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME" >> "${dockerLog}"
exit 0
`
    );

    const result = spawnSync("bash", ["scripts/worktree-down.sh", "--purge"], {
      cwd: projectDir,
      encoding: "utf8",
      env: {
        ...envWithoutConductor(),
        PATH: `${join(projectDir, "bin")}:${process.env.PATH ?? ""}`,
      },
    });

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(readFileSync(dockerLog, "utf8")).toContain("down -v DB_PORT=6123");
  });

  it("utilise un nom de projet Docker distinct pour chaque worktree manuel", () => {
    const projectNames = new Set<string>();

    for (const label of ["first", "second"]) {
      const projectDir = prepareProject(label, `DB_PORT="${label === "first" ? 6124 : 6125}"\n`);
      const dockerLog = join(projectDir, "docker.log");

      writeExecutable(
        join(projectDir, "bin", "docker"),
        `#!/usr/bin/env bash
echo "$COMPOSE_PROJECT_NAME" >> "${dockerLog}"
exit 0
`
      );

      const result = spawnSync("bash", ["scripts/worktree-down.sh"], {
        cwd: projectDir,
        encoding: "utf8",
        env: {
          ...envWithoutConductor(),
          PATH: `${join(projectDir, "bin")}:${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      projectNames.add(readFileSync(dockerLog, "utf8").trim().split("\n")[0]);
    }

    expect(projectNames.size).toBe(2);
  });
});
