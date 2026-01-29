import { z } from "zod";

export const RepoSpecSchema = z.object({
  spec: z.string(),
  owner: z.string(),
  name: z.string(),
  branch: z.string().optional(),
  dir: z.string(),
  readOnly: z.boolean().optional(),
  latest: z.boolean().optional(),
});

export const SessionManifestSchema = z.object({
  name: z.string(),
  repos: z.array(RepoSpecSchema),
  goal: z.string().optional(),
  skills: z.array(z.string()).optional(),
  created: z.string().datetime(),
  lastAccessed: z.string().datetime(),
});

export const SessionSchema = SessionManifestSchema.extend({
  path: z.string(),
});

export const NewSessionParamsSchema = z.object({
  repos: z.array(RepoSpecSchema).min(1, "At least one repo is required"),
  goal: z.string().optional(),
  skills: z.array(z.string()).optional(),
  mode: z.enum(["cli", "tui"]),
  skipConflictCheck: z.boolean().optional(),
});

export type RepoSpec = z.infer<typeof RepoSpecSchema>;
export type SessionManifest = z.infer<typeof SessionManifestSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type NewSessionParams = z.infer<typeof NewSessionParamsSchema>;

export const ConflictChoiceSchema = z.enum(["resume", "nuke", "new", "cancel"]);
export type ConflictChoice = z.infer<typeof ConflictChoiceSchema>;

export const ExitChoiceSchema = z.enum(["resume", "edit", "home", "delete"]);
export type ExitChoice = z.infer<typeof ExitChoiceSchema>;

export function parseRepoSpec(spec: string): RepoSpec {
  const colonIndex = spec.indexOf(":");
  const repoPath = colonIndex === -1 ? spec : spec.slice(0, colonIndex);
  const branch = colonIndex === -1 ? undefined : spec.slice(colonIndex + 1);

  const slashIndex = repoPath.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(`Invalid repo format: ${spec} (expected owner/repo or owner/repo:branch)`);
  }

  const owner = repoPath.slice(0, slashIndex);
  const name = repoPath.slice(slashIndex + 1);

  if (!owner || !name) {
    throw new Error(`Invalid repo format: ${spec} (expected owner/repo or owner/repo:branch)`);
  }

  return {
    spec,
    owner,
    name,
    branch,
    dir: name,
  };
}

export function repoSpecsMatch(a: RepoSpec[], b: RepoSpec[]): boolean {
  if (a.length !== b.length) return false;

  const aSpecs = new Set(a.map((r) => `${r.owner}/${r.name}`));
  const bSpecs = new Set(b.map((r) => `${r.owner}/${r.name}`));

  for (const spec of aSpecs) {
    if (!bSpecs.has(spec)) return false;
  }

  return true;
}
