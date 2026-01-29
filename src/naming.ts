import { generateText } from "ai";

import type { RepoSpec } from "./types";

import { generateUniqueName } from "./sessions";

export async function generateSessionName(
  repos: RepoSpec[],
  goal?: string
): Promise<string> {
  const repoList = repos.map((r) => `${r.owner}/${r.name}`).join(", ");

  try {
    const { text } = await generateText({
      model: "xai/grok-3-mini-fast",
      temperature: 1.2, // Higher temperature for more creative/varied names
      prompt: `Generate a creative, memorable session name for a coding workspace.

Repos: ${repoList}
${goal ? `Goal: ${goal}` : "No specific goal provided."}

Requirements:
- Max 24 characters total
- Lowercase kebab-case only (e.g., "test-bot-fusion", "react-dash")
- Creative and memorable - don't just mash repo names together
- Should capture the essence of the goal if provided
- No special characters except hyphens
- No numbers unless they add meaning

Reply with ONLY the name, nothing else. No quotes, no explanation.`,
    });

    // Clean up the response
    let name = text
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]/g, "")
      .replaceAll(/--+/g, "-")
      .replaceAll(/^-|-$/g, "")
      .slice(0, 24);

    // Fallback if AI returns garbage
    if (!name || name.length < 3) {
      name = generateFallbackName(repos);
    }

    // Ensure uniqueness
    return generateUniqueName(name);
  } catch (error) {
    // If AI fails, use fallback
    console.error("AI naming failed, using fallback:", error);
    const fallback = generateFallbackName(repos);
    return generateUniqueName(fallback);
  }
}

export function generateFallbackName(repos: RepoSpec[]): string {
  // Simple fallback: first repo name + short hash
  const base = repos[0]?.name || "session";
  const hash = Math.random().toString(36).slice(2, 6);
  return `${base}-${hash}`.slice(0, 24);
}
