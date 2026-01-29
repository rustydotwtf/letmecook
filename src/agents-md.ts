import { symlink } from "node:fs/promises";
import { join } from "node:path";

import type { Session } from "./types";

export function generateAgentsMd(session: Session): string {
  const createdDate = new Date(session.created).toLocaleDateString("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "long",
    year: "numeric",
  });

  const hasReadOnlyRepos = session.repos.some((repo) => repo.readOnly);
  const hasSkills = session.skills && session.skills.length > 0;

  const repoRows = session.repos
    .map((repo) => {
      const branch = repo.branch || "default";
      const url = `https://github.com/${repo.owner}/${repo.name}`;
      const readOnlyStatus = repo.readOnly ? "**YES**" : "no";
      return `| \`${repo.dir}/\` | [${repo.owner}/${repo.name}](${url}) | ${branch} | ${readOnlyStatus} |`;
    })
    .join("\n");

  const readOnlyRepos = session.repos.filter((repo) => repo.readOnly);

  const skillsSection = hasSkills
    ? `
## 🎯 Skills

Installed skill packages (managed by bunx skills):

${(session.skills || []).map((skill) => `- \`${skill}\``).join("\n")}

These skills are available for use in this session and are automatically updated before launching.
`
    : "";

  const readOnlyWarning = hasReadOnlyRepos
    ? `
## ⚠️ Read-Only Repositories

**WARNING: The following repositories are marked as READ-ONLY:**

${readOnlyRepos.map((repo) => `- \`${repo.dir}/\` (${repo.owner}/${repo.name})`).join("\n")}

**AI agents must NOT:**
- Create, modify, or delete any files in these directories
- Make commits affecting these repositories
- Use bash commands to circumvent file permissions

**Why are these read-only?**
These repositories are included for reference only. The user wants to read and understand the code without risk of accidental modifications.
`
    : "";

  return `# letmecook Session: ${session.name}

${session.goal ? `> ${session.goal}\n` : ""}
## Session Info
- **Created**: ${createdDate}

## Repositories

| Directory | Repository | Branch | Read-Only |
|-----------|------------|--------|-----------|
${repoRows}
${readOnlyWarning}
${skillsSection}
## Important Notes

- This is a **multi-repo workspace** - each subdirectory is a separate git repository
- Make commits within individual repo directories, not from the workspace root
- This workspace root is NOT a git repository
- Your changes persist until you explicitly nuke the session

## Resume This Session

\`\`\`bash
letmecook --resume ${session.name}
\`\`\`
`;
}

export async function writeAgentsMd(session: Session): Promise<void> {
  const content = generateAgentsMd(session);
  const path = join(session.path, "AGENTS.md");
  await Bun.write(path, content);
}

export async function createClaudeMdSymlink(
  sessionPath: string
): Promise<void> {
  const symlinkPath = join(sessionPath, "CLAUDE.md");
  try {
    await symlink("AGENTS.md", symlinkPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      console.warn(`Could not create CLAUDE.md symlink: ${error}`);
    }
  }
}
