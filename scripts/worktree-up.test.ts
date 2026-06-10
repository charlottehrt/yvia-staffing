import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
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

function listen(server: net.Server, port: number) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function close(server: net.Server) {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function findOccupiedPortWithFreeSuccessor() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const blocker = net.createServer();
    await listen(blocker, 0);
    const address = blocker.address();
    if (!address || typeof address === "string" || address.port >= 65535) {
      await close(blocker);
      continue;
    }

    const successorProbe = net.createServer();
    try {
      await listen(successorProbe, address.port + 1);
      await close(successorProbe);
      return { blocker, occupiedPort: address.port, freePort: address.port + 1 };
    } catch {
      await close(successorProbe);
      await close(blocker);
    }
  }

  throw new Error("Could not find adjacent test ports");
}

describe("scripts/worktree-up.sh", () => {
  it("skips an occupied Conductor database port", async () => {
    const { blocker, occupiedPort, freePort } = await findOccupiedPortWithFreeSuccessor();
    try {
      const projectDir = mkdtempSync(join(tmpdir(), "worktree-up-"));
      tempDirs.push(projectDir);
      mkdirSync(join(projectDir, "scripts"));
      mkdirSync(join(projectDir, "bin"));

      writeFileSync(
        join(projectDir, "scripts", "worktree-up.sh"),
        readFileSync(join(import.meta.dirname, "worktree-up.sh"), "utf8")
      );
      chmodSync(join(projectDir, "scripts", "worktree-up.sh"), 0o755);

      const dockerLog = join(projectDir, "docker.log");
      const npmLog = join(projectDir, "npm.log");

      writeExecutable(
        join(projectDir, "bin", "docker"),
        `#!/usr/bin/env bash
echo "$* DB_PORT=$DB_PORT COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME" >> "${dockerLog}"
exit 0
`
      );
      writeExecutable(
        join(projectDir, "bin", "npm"),
        `#!/usr/bin/env bash
echo "$*" >> "${npmLog}"
exit 0
`
      );
      writeExecutable(
        join(projectDir, "bin", "openssl"),
        `#!/usr/bin/env bash
printf 'test-secret'
`
      );

      const result = spawnSync("bash", ["scripts/worktree-up.sh"], {
        cwd: projectDir,
        encoding: "utf8",
        env: {
          ...process.env,
          CONDUCTOR_PORT: String(occupiedPort - 1),
          CONDUCTOR_WORKSPACE_NAME: "Port Test",
          PATH: `${join(projectDir, "bin")}:${process.env.PATH ?? ""}`,
        },
      });

      expect(`${result.stdout}\n${result.stderr}`).toContain(
        `.env : DATABASE_URL pointe vers le port ${freePort}`
      );
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      expect(readFileSync(join(projectDir, ".env"), "utf8")).toContain(`localhost:${freePort}`);
      expect(readFileSync(dockerLog, "utf8")).toContain(`DB_PORT=${freePort}`);
    } finally {
      await close(blocker);
    }
  });
});
