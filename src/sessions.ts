import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readdir, rm } from "node:fs/promises";
import type { Session, SessionManifest, RepoSpec } from "./types";
import { repoSpecsMatch } from "./types";

const LETMECOOK_DIR = join(homedir(), ".letmecook");
const SESSIONS_DIR = join(LETMECOOK_DIR, "sessions");

export async function ensureSessionsDir(): Promise<void> {
  await mkdir(SESSIONS_DIR, { recursive: true });
}

export async function getSessionPath(name: string): Promise<string> {
  return join(SESSIONS_DIR, name);
}

export async function listSessions(): Promise<Session[]> {
  await ensureSessionsDir();

  const entries = await readdir(SESSIONS_DIR, { withFileTypes: true });
  const sessions: Session[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const sessionPath = join(SESSIONS_DIR, entry.name);
    const manifestPath = join(sessionPath, "manifest.json");

    try {
      const manifestFile = Bun.file(manifestPath);
      if (await manifestFile.exists()) {
        const manifest: SessionManifest = await manifestFile.json();
        sessions.push({
          ...manifest,
          path: sessionPath,
        });
      }
    } catch {
      // Skip invalid sessions
    }
  }

  // Sort by lastAccessed, most recent first
  sessions.sort((a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime());

  return sessions;
}

export async function getSession(name: string): Promise<Session | null> {
  const sessionPath = join(SESSIONS_DIR, name);
  const manifestPath = join(sessionPath, "manifest.json");

  try {
    const manifestFile = Bun.file(manifestPath);
    if (await manifestFile.exists()) {
      const manifest: SessionManifest = await manifestFile.json();
      return {
        ...manifest,
        path: sessionPath,
      };
    }
  } catch {
    // Session doesn't exist or is invalid
  }

  return null;
}

export async function findMatchingSession(repos: RepoSpec[]): Promise<Session | null> {
  const sessions = await listSessions();

  for (const session of sessions) {
    if (repoSpecsMatch(session.repos, repos)) {
      return session;
    }
  }

  return null;
}

export async function createSession(
  name: string,
  repos: RepoSpec[],
  goal?: string,
  skills?: string[],
): Promise<Session> {
  await ensureSessionsDir();

  const sessionPath = join(SESSIONS_DIR, name);
  await mkdir(sessionPath, { recursive: true });

  const now = new Date().toISOString();
  const manifest: SessionManifest = {
    name,
    repos,
    goal,
    skills,
    created: now,
    lastAccessed: now,
  };

  const manifestPath = join(sessionPath, "manifest.json");
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    ...manifest,
    path: sessionPath,
  };
}

export async function updateLastAccessed(name: string): Promise<void> {
  const session = await getSession(name);
  if (!session) return;

  const manifest: SessionManifest = {
    name: session.name,
    repos: session.repos,
    goal: session.goal,
    created: session.created,
    lastAccessed: new Date().toISOString(),
  };

  const manifestPath = join(session.path, "manifest.json");
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
}

export async function updateSessionRepos(name: string, repos: RepoSpec[]): Promise<Session | null> {
  const session = await getSession(name);
  if (!session) return null;

  const manifest: SessionManifest = {
    name: session.name,
    repos,
    goal: session.goal,
    created: session.created,
    lastAccessed: new Date().toISOString(),
  };

  const manifestPath = join(session.path, "manifest.json");
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    ...manifest,
    path: session.path,
  };
}

export async function updateSessionSettings(
  name: string,
  settings: { repos?: RepoSpec[]; goal?: string; skills?: string[] },
): Promise<Session | null> {
  const session = await getSession(name);
  if (!session) return null;

  const manifest: SessionManifest = {
    name: session.name,
    repos: settings.repos ?? session.repos,
    goal: settings.goal ?? session.goal,
    skills: settings.skills ?? session.skills,
    created: session.created,
    lastAccessed: new Date().toISOString(),
  };

  const manifestPath = join(session.path, "manifest.json");
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    ...manifest,
    path: session.path,
  };
}

export async function updateSessionSkills(name: string, skills: string[]): Promise<Session | null> {
  return updateSessionSettings(name, { skills });
}

export async function deleteSession(name: string): Promise<boolean> {
  const sessionPath = join(SESSIONS_DIR, name);

  try {
    await rm(sessionPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export async function deleteAllSessions(): Promise<number> {
  const sessions = await listSessions();
  const count = sessions.length;

  try {
    // Nuke entire .letmecook directory including SQLite history
    await rm(LETMECOOK_DIR, { recursive: true, force: true });
    return count;
  } catch {
    return 0;
  }
}

export async function sessionExists(name: string): Promise<boolean> {
  const session = await getSession(name);
  return session !== null;
}

export async function generateUniqueName(baseName: string): Promise<string> {
  let name = baseName;
  let counter = 2;

  while (await sessionExists(name)) {
    name = `${baseName}-${counter}`;
    counter++;
  }

  return name;
}
