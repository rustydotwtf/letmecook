import type { CliRenderer } from "@opentui/core";

import type { Session } from "../types";

import { writeAgentsMd } from "../agents-md";
import { updateSessionSkills } from "../sessions";
import { addSkillToSession } from "../skills";
import { showSkillsPrompt } from "../ui/skills";

export interface AddSkillsParams {
  renderer: CliRenderer;
  session: Session;
}

export interface AddSkillsResult {
  session: Session;
  cancelled: boolean;
}

function filterNewSkills(
  selectedSkills: string[],
  existingSkills: Set<string>
): string[] {
  return selectedSkills.filter((s) => !existingSkills.has(s));
}

async function addSkillsToSession(
  session: Session,
  newSkills: string[]
): Promise<boolean> {
  console.log(`\nAdding ${newSkills.length} skill package(s)...`);

  for (const skill of newSkills) {
    console.log(`  Adding ${skill}...`);
    const { success } = await addSkillToSession(session, skill, (output) => {
      console.log(`    ${output}`);
    });

    if (success) {
      console.log(`  ✓ ${skill}`);
    } else {
      console.log(`  ✗ ${skill} (addition failed)`);
    }
  }

  return true;
}

async function finalizeSkillAddition(
  session: Session,
  newSkills: string[]
): Promise<Session | null> {
  const allSkills = [...(session.skills || []), ...newSkills];
  const updatedSession = await updateSessionSkills(session.name, allSkills);

  if (!updatedSession) {
    return null;
  }

  await writeAgentsMd(updatedSession);
  console.log("\n✅ Skills added.\n");
  return updatedSession;
}

async function processSelectedSkills(
  session: Session,
  selectedSkills: string[]
): Promise<AddSkillsResult> {
  const existingSkills = new Set(session.skills || []);
  const newSkills = filterNewSkills(selectedSkills, existingSkills);

  if (newSkills.length > 0) {
    await addSkillsToSession(session, newSkills);
    const updatedSession = await finalizeSkillAddition(session, newSkills);

    if (updatedSession) {
      return { cancelled: false, session: updatedSession };
    }
  }

  console.log("\nNo new skills to add (all already in session).\n");
  return { cancelled: false, session };
}

export async function addSkillsFlow(
  params: AddSkillsParams
): Promise<AddSkillsResult> {
  const { renderer, session } = params;

  const { skills, cancelled } = await showSkillsPrompt(
    renderer,
    session.skills || []
  );

  if (cancelled) {
    return { cancelled, session };
  }

  if (skills.length > 0) {
    return processSelectedSkills(session, skills);
  }

  return { cancelled, session };
}
