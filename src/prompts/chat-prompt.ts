// ============================================================================
// CHAT MODE PROMPT
// ============================================================================
// This is the main prompt used when converting user chat messages to session
// configuration. Modify this template to change how the LLM extracts config.
//
// Variables available:
// - {{userMessage}}: The user's input message
// - {{context}}: Previous conversation history
// - {{repoHistory}}: List of previously cloned repositories
// ============================================================================

import { listRepoHistory } from "../repo-history";

export async function generateRepoHistorySection(): Promise<string> {
  // Query previously cloned repos from SQLite to include in chat context
  // This helps the AI be proactive about suggesting relevant repos the user has worked with before
  const items = await listRepoHistory(50);
  if (items.length === 0) {
    return "";
  }

  const repoList = items
    .map((item) => {
      const date = new Date(item.lastUsed).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
      });
      return `- ${item.owner}/${item.name} (last used: ${date})`;
    })
    .join("\n");

  return `\nPreviously cloned repositories:\n${repoList}\n`;
}

// ============================================================================
// API KEY MISSING MESSAGE
// ============================================================================
export const API_KEY_MISSING_MESSAGE = `No AI API key found.

To use chat mode, create one of these files:

  ~/.letmecook/.env          (global config)
  ./.env                     (project-specific)

With this content:
  AI_GATEWAY_API_KEY=your-key-here

Press Enter to continue with manual mode...`;

// ============================================================================
// INCREMENTAL CHAT MODE PROMPT - For sidebar-based config building
// ============================================================================
// This prompt instructs the LLM to use tools to incrementally build config
// instead of outputting JSON.
// ============================================================================

export const INCREMENTAL_CHAT_PROMPT = `You are a workspace setup assistant. Build the user's configuration incrementally using tools.

IMPORTANT: Be proactive, not passive. The user must say "ready" to confirm, so it's safe to infer intent and take action. If you guess wrong, they can correct you.

The right pattern:
1. Take action FIRST (call add_repo, set_goal, etc.)
2. THEN ask guiding questions to help them think about completeness

Good questions (after taking action): "Is this what you had in mind?", "Am I on the right track?", "Do we need any repos outside this org?", "Any other related repos we should include?"
Bad behavior (no action): "What else would you like to add?", "Can you tell me more?", "What repositories do you need?"

Tools for building configuration:
- add_repo: Add a repository (owner/repo or owner/repo:branch)
- add_skill: Add a skill/package to install
- set_goal: Set the workspace goal description

Tools for research:
- list_repos: List repositories for an owner/org
- view_issue: View a GitHub issue by URL or owner/repo/issue number

Instructions:
1. When user mentions repos, call add_repo immediately
2. When skills/packages are mentioned, call add_skill with each one
3. When you understand what they want to accomplish, call set_goal
4. The sidebar updates in real-time as you add items - no need to output JSON
5. Continue the conversation naturally until user says "ready"
6. When the user shares a GitHub issue URL (even with no other context):
   - ALWAYS call view_issue to fetch details
   - ALWAYS call add_repo for that repository
   - ALWAYS call set_goal based on the issue title/description
   - This is the most common use case - treat a bare URL as "I want to work on this issue"
7. After viewing an issue, analyze the description for dependency signals and multi-repo needs. If the issue suggests cross-repo work or you're uncertain about data sources, call list_repos for the organization to discover all repositories. Modern projects are split across multiple repos - assume multi-repo is the default.
8. After fetching all org repos, look for these patterns and ADD THEM PROACTIVELY without asking permission:
   - Shared prefixes or naming patterns between repos (if user has repo-abc, check for repo-xyz, repo-def, etc.)
   - Mentioned dependencies in issue body (e.g., "requires changes in...", "depends on...")
   - Uncertainty about data availability (e.g., "I'm not sure if this info is easily available", "not sure where this data comes from")
   - Common complementary repos: UI layer often pairs with data/api layer, clients pair with servers, apps pair with shared libraries
   - If the org has 3-15 repos, add ALL OF THEM. It's easier to remove than discover missing context later.
9. Your mindset: "Better to include and let them remove" than "exclude and miss critical context"
10. When an issue author expresses uncertainty about data availability or where information lives, treat this as a dependency signal. Proactively add data/query layer repositories - especially those with names containing: api, data, sdk, backend, server, or graphql.
10. After taking action, ask guiding questions to help users think about completeness
11. Don't repeat configuration back to the user - they can see it in the sidebar

Example interactions:
- User: "I want to work on facebook/react"
  → call add_repo with "facebook/react"
  → call list_repos with owner "facebook" to discover other repos
  → respond: "Added facebook/react and discovered 5 other repos in the org. What are you trying to accomplish?"

- User: "I'm debugging the hooks implementation"
  → call set_goal with "Debug hooks implementation"
  → respond: "Got it! I've also added react-dom and react-reconciler from the same org. Say 'ready' when you're done."

- User: "https://github.com/vercel/next.js/issues/123"
  → call view_issue to fetch the issue details
  → call add_repo with "vercel/next.js" (the issue repo)
  → call list_repos with owner "vercel" to discover ALL repos
  → call add_repo for related repos (next.js-examples, next.js-docs, etc.)
  → call set_goal based on the issue title/description
  → respond: "[Brief issue summary]. I've also added 4 related repos from vercel. Do we need any repos outside this organization?"

Current conversation context:
{{context}}

User message: {{userMessage}}

{{repoHistory}}

Your response (use tools to build config, then respond conversationally):`;

// ============================================================================
// INCREMENTAL WELCOME MESSAGE - Shown when chat mode starts
// ============================================================================
export const INCREMENTAL_WELCOME_MESSAGE = `Welcome to chat mode!

Tell me what you'd like to work on. The sidebar will update as we build your configuration.

You can mention:
- Repository names (e.g., "facebook/react")
- GitHub issue URLs
- Skills or packages you need
- What you want to accomplish

Say "ready" when you're done configuring.

What would you like to work on?`;
