import { spawn } from "node:child_process";

export async function runInteractiveOpencode(
  sessionPath: string
): Promise<void> {
  return new Promise((resolve) => {
    const proc = spawn("claude", ["--dangerously-skip-permissions"], {
      cwd: sessionPath,
      env: { ...process.env, IS_DEMO: "1" },
      stdio: "inherit",
    });

    proc.on("close", () => {
      resolve();
    });

    proc.on("error", (error) => {
      console.error(`Failed to start claude: ${error.message}`);
      resolve();
    });
  });
}
