import { homedir } from "node:os";
import { join } from "node:path";

const LETMECOOK_DIR = join(homedir(), ".letmecook");

async function loadEnvFile(file: ReturnType<typeof Bun.file>): Promise<void> {
  if (await file.exists()) {
    try {
      const content = await file.text();
      parseAndSetEnv(content);
    } catch {
      // Ignore errors
    }
  }
}

export async function loadEnvAsync(): Promise<void> {
  if (process.env.AI_GATEWAY_API_KEY) {
    return;
  }

  const globalEnvPath = join(LETMECOOK_DIR, ".env");
  const globalEnvFile = Bun.file(globalEnvPath);
  const localEnvPath = join(process.cwd(), ".env");
  const localEnvFile = Bun.file(localEnvPath);

  await loadEnvFile(globalEnvFile);
  await loadEnvFile(localEnvFile);
}

export function loadEnv(): void {
  (async () => {
    try {
      await loadEnvAsync();
    } catch {
      // Ignore errors
    }
  })();
}

function removeQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvLine(line: string): [string, string] | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return;
  }
  const equalIndex = trimmed.indexOf("=");
  if (equalIndex === -1) {
    return;
  }
  const key = trimmed.slice(0, equalIndex).trim();
  const value = removeQuotes(trimmed.slice(equalIndex + 1).trim());
  if (key) {
    return [key, value];
  }
}

function parseAndSetEnv(content: string): void {
  for (const line of content.split("\n")) {
    const parsed = parseEnvLine(line);
    if (parsed) {
      const [key, value] = parsed;
      process.env[key] = value;
    }
  }
}
