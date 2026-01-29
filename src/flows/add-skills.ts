import type { CliRenderer } from "@opentui/core";
import type { Session } from "../types";
import { updateSessionSkills } from "../sessions";
import { writeAgentsMd } from "../agents-md";
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

export async function addSkillsFlow(params: AddSkillsParams): Promise<AddSkillsResult> {
  const { renderer, session } = params;

  const { skills, cancelled } = await showSkillsPrompt(renderer, session.skills || []);

  if (!cancelled && skills.length > 0) {
    const existingSkills = new Set(session.skills || []);
    const newSkills = skills.filter((s) => !existingSkills.has(s));

    if (newSkills.length > 0) {
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

      const allSkills = [...(session.skills || []), ...newSkills];
      const updatedSession = await updateSessionSkills(session.name, allSkills);

      if (updatedSession) {
        await writeAgentsMd(updatedSession);
        console.log("\n✅ Skills added.\n");
        return { session: updatedSession, cancelled: false };
      }
    }

    console.log("\nNo new skills to add (all already in session).\n");
  }

  return { session, cancelled };
}
