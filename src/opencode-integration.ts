import { spawn } from "node:child_process";
import { once } from "node:events";

export async function runInteractiveOpencode(
  sessionPath: string
): Promise<void> {
  const proc = spawn("claude", ["--dangerously-skip-permissions"], {
    cwd: sessionPath,
    env: { ...process.env, IS_DEMO: "1" },
    stdio: "inherit",
  });

  await once(proc, "close").catch<void>((error) => {
    console.error(`Failed to start claude: ${error.message}`);
  });
}
