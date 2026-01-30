import type { Session } from "./types";

import { writeAgentsMd } from "./agents-md";
import { updateSessionSkills } from "./sessions";
import { readProcessOutput } from "./utils/stream";

export function updateSkills(
  session: Session,
  onProgress?: (output: string) => void
): Promise<{ success: boolean; output: string[] }> {
  if (!session.skills || session.skills.length === 0) {
    return Promise.resolve({ output: [], success: true });
  }

  const proc = Bun.spawn(["bunx", "skills", "update", "-y"], {
    cwd: session.path,
    stderr: "pipe",
    stdout: "pipe",
  });

  return readProcessOutput(proc, onProgress);
}

export function addSkillToSession(
  session: Session,
  skillString: string,
  onProgress?: (output: string) => void
): Promise<{ success: boolean; output: string[] }> {
  const proc = Bun.spawn(["bunx", "skills", "add", skillString, "-y"], {
    cwd: session.path,
    stderr: "pipe",
    stdout: "pipe",
  });

  return readProcessOutput(proc, onProgress);
}

export async function removeSkillFromSession(
  session: Session,
  skillString: string
): Promise<Session> {
  const updatedSkills = (session.skills || []).filter((s) => s !== skillString);
  const updatedSession = await updateSessionSkills(session.name, updatedSkills);

  if (updatedSession) {
    await writeAgentsMd(updatedSession);
  }

  return updatedSession || session;
}
