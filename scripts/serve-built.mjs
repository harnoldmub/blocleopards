import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function parseDotEnv(path) {
  if (!existsSync(path)) return {};

  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const child = spawn(process.execPath, ["./dist/server/entry.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...parseDotEnv(".env"),
    HOST: process.env.HOST ?? "127.0.0.1",
    PORT: process.env.PORT ?? "5056",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
