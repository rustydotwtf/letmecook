import type { RepoSpec } from "../../types";

export interface RepoFormatterOptions {
  showMarkers?: boolean;
  prefix?: string;
}

export function formatRepoList(
  repos: RepoSpec[],
  options: RepoFormatterOptions = {}
): string {
  const { showMarkers = true, prefix = "" } = options;

  if (repos.length === 0) return "(none)";

  return repos
    .map((repo) => {
      let text = `${prefix}${repo.owner}/${repo.name}`;

      if (showMarkers) {
        const branchMarker = repo.branch ? ` (${repo.branch})` : "";
        const readOnlyMarker = repo.readOnly ? " [Read-only]" : "";
        text += `${branchMarker}${readOnlyMarker}`;
      }

      return text;
    })
    .join("\n");
}

export function formatRepoString(repo: RepoSpec): string {
  const parts = [`${repo.owner}/${repo.name}`];

  if (repo.branch) {
    parts.push(`(${repo.branch})`);
  }

  if (repo.readOnly) {
    parts.push("[Read-only]");
  }

  return parts.join(" ");
}
