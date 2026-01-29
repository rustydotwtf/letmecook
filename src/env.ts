import { homedir } from "node:os";
import { join } from "node:path";

const LETMECOOK_DIR = join(homedir(), ".letmecook");

export async function loadEnvAsync(): Promise<void> {
  // Check if AI_GATEWAY_API_KEY is already set
  if (process.env.AI_GATEWAY_API_KEY) {
    return;
  }

  // Try loading from ~/.letmecook/.env
  const globalEnvPath = join(LETMECOOK_DIR, ".env");
  const globalEnvFile = Bun.file(globalEnvPath);

  // Try loading from ./.env (current directory)
  const localEnvPath = join(process.cwd(), ".env");
  const localEnvFile = Bun.file(localEnvPath);

  // Load global first, then local (local overrides)
  try {
    if (await globalEnvFile.exists()) {
      const content = await globalEnvFile.text();
      parseAndSetEnv(content);
    }
  } catch {
    // Ignore errors
  }

  try {
    if (await localEnvFile.exists()) {
      const content = await localEnvFile.text();
      parseAndSetEnv(content);
    }
  } catch {
    // Ignore errors
  }
}

export function loadEnv(): void {
  // Synchronous version - fire and forget
  loadEnvAsync().catch(() => {
    // Ignore errors
  });
}

function parseAndSetEnv(content: string): void {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      process.env[key] = value;
    }
  }
}
