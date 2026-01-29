import { type ToolSet, streamText } from "ai";
import { z } from "zod";

import type { ConfigBuilder } from "../config-builder";

import {
  INCREMENTAL_CHAT_PROMPT,
  generateRepoHistorySection,
} from "../prompts/chat-prompt";
import { listRepoHistory } from "../repo-history";
import { type RepoSpec, parseRepoSpec } from "../schemas";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatConfig {
  repos: string[];
  skills: string[];
  goal: string;
}

export interface ToolCallResult {
  toolName: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export function configToRepoSpecs(config: ChatConfig): RepoSpec[] {
  return config.repos.map((spec) => parseRepoSpec(spec));
}

// ============================================================================
// INCREMENTAL CHAT MODE - Tools add config items directly
// ============================================================================

export interface IncrementalChatResult {
  response: string;
  toolResults?: ToolCallResult[];
  error?: string;
}

/**
 * Process chat with incremental config building.
 * Tools directly modify the ConfigBuilder, which emits events to update UI.
 */
export async function chatToConfigIncremental(
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  onChunk: (chunk: string) => void
): Promise<IncrementalChatResult> {
  const context = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const userMessage =
    messages.findLast((m) => m.role === "user")?.content ?? "";

  const repoHistory = await generateRepoHistorySection();

  const prompt = INCREMENTAL_CHAT_PROMPT.replace("{{context}}", context)
    .replace("{{userMessage}}", userMessage)
    .replace("{{repoHistory}}", repoHistory);

  try {
    const toolTimings = new Map<string, number>();

    const tools: ToolSet = {
      // Config building tools
      add_repo: {
        description: "Add a repository to the workspace configuration",
        execute: async ({ repo }) => {
          const startTime = Date.now();

          // Validate repo exists on GitHub using gh CLI
          const repoPath = repo.includes(":") ? repo.split(":")[0] : repo;
          const branch = repo.includes(":") ? repo.split(":")[1] : undefined;

          const validationProc = Bun.spawn(
            ["gh", "repo", "view", repoPath, "--json", "nameWithOwner"],
            {
              stderr: "pipe",
              stdout: "pipe",
            }
          );

          const validationOutput = await new Response(
            validationProc.stdout
          ).text();
          const validationStderr = await new Response(
            validationProc.stderr
          ).text();

          if (validationStderr && !validationOutput) {
            const duration = Date.now() - startTime;
            toolTimings.set("add_repo", duration);
            return {
              currentRepos: configBuilder.config.repos,
              error: `Repository '${repoPath}' not found on GitHub. Please check the owner and repository name.`,
              success: false,
            };
          }

          // If branch is specified, validate it exists
          if (branch) {
            const branchProc = Bun.spawn(
              ["gh", "api", `repos/${repoPath}/git/refs/heads/${branch}`],
              {
                stderr: "pipe",
                stdout: "pipe",
              }
            );

            const branchOutput = await new Response(branchProc.stdout).text();
            const branchStderr = await new Response(branchProc.stderr).text();

            if (branchStderr && !branchOutput) {
              const duration = Date.now() - startTime;
              toolTimings.set("add_repo", duration);
              return {
                currentRepos: configBuilder.config.repos,
                error: `Branch '${branch}' not found in repository '${repoPath}'.`,
                success: false,
              };
            }
          }

          const added = configBuilder.addRepo(repo);
          const duration = Date.now() - startTime;
          toolTimings.set("add_repo", duration);
          return {
            currentRepos: configBuilder.config.repos,
            message: added ? `Added ${repo}` : `${repo} already in config`,
            success: added,
          };
        },
        inputSchema: z.object({
          repo: z
            .string()
            .describe("Repository in format owner/repo or owner/repo:branch"),
        }),
        title: "add_repo",
      },
      add_skill: {
        description: "Add a skill or package to install in the workspace",
        execute: ({ skill }) => {
          const startTime = Date.now();
          const added = configBuilder.addSkill(skill);
          const duration = Date.now() - startTime;
          toolTimings.set("add_skill", duration);
          return {
            currentSkills: configBuilder.config.skills,
            message: added
              ? `Added skill ${skill}`
              : `${skill} already in config`,
            success: added,
          };
        },
        inputSchema: z.object({
          skill: z.string().describe("Skill or package name to install"),
        }),
        title: "add_skill",
      },
      set_goal: {
        description: "Set the goal/purpose for this workspace session",
        execute: ({ goal }) => {
          const startTime = Date.now();
          configBuilder.setGoal(goal);
          const duration = Date.now() - startTime;
          toolTimings.set("set_goal", duration);
          return {
            message: `Goal set to: ${goal}`,
            success: true,
          };
        },
        inputSchema: z.object({
          goal: z
            .string()
            .describe("Brief description of what the user wants to accomplish"),
        }),
        title: "set_goal",
      },
      // Research tools (existing)
      list_repos: {
        description: "List all repositories for a given owner/organization",
        execute: async ({ owner, limit, topic }) => {
          const startTime = Date.now();
          const args = [
            "repo",
            "list",
            owner,
            "--json",
            "nameWithOwner",
            "--jq",
            ".[].nameWithOwner",
          ];
          if (limit) {
            args.push("--limit", String(limit));
          }
          if (topic) {
            args.push("--topic", topic);
          }
          const proc = Bun.spawn(["gh", ...args], {
            stderr: "pipe",
            stdout: "pipe",
          });
          const output = await new Response(proc.stdout).text();
          const result = {
            repos: output.trim().split("\n").filter(Boolean),
          };
          const duration = Date.now() - startTime;
          toolTimings.set("list_repos", duration);
          return result;
        },
        inputSchema: z.object({
          limit: z.number().optional(),
          owner: z.string(),
          topic: z.string().optional(),
        }),
        title: "list_repos",
      },
      view_issue: {
        description:
          "View a GitHub issue. Accepts either a full GitHub URL or owner/repo with issue number.",
        execute: async ({ url, owner, repo, issue }) => {
          const startTime = Date.now();

          let repoPath: string;
          let issueNumber: number;

          if (url) {
            // Parse URL like https://github.com/owner/repo/issues/123
            const match = url.match(
              /github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/
            );
            if (!match) {
              return { error: "Invalid GitHub issue URL", markdown: "" };
            }
            repoPath = `${match[1]}/${match[2]}`;
            issueNumber = Number.parseInt(match[3], 10);
          } else if (owner && repo && issue) {
            repoPath = `${owner}/${repo}`;
            issueNumber = issue;
          } else {
            return {
              error: "Provide either a URL or owner/repo/issue",
              markdown: "",
            };
          }

          const proc = Bun.spawn(
            [
              "gh",
              "issue",
              "view",
              String(issueNumber),
              "--repo",
              repoPath,
              "--json",
              "title,body,state,author,labels,createdAt,comments,url",
            ],
            {
              stderr: "pipe",
              stdout: "pipe",
            }
          );

          const output = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();

          if (stderr && !output) {
            return { error: stderr.trim(), markdown: "" };
          }

          try {
            const data = JSON.parse(output);
            const labels =
              data.labels?.map((l: { name: string }) => l.name).join(", ") ||
              "None";
            const commentCount = data.comments?.length || 0;

            const markdown = `## ${data.title}

**Repository:** ${repoPath}
**Issue:** #${issueNumber}
**State:** ${data.state}
**Author:** ${data.author?.login || "Unknown"}
**Labels:** ${labels}
**Created:** ${new Date(data.createdAt).toLocaleDateString()}
**Comments:** ${commentCount}
**URL:** ${data.url}

---

${data.body || "*No description provided*"}`;

            const duration = Date.now() - startTime;
            toolTimings.set("view_issue", duration);

            return {
              markdown,
              repoPath,
              state: data.state,
              title: data.title,
              url: data.url,
            };
          } catch {
            return { error: "Failed to parse issue data", markdown: "" };
          }
        },
        inputSchema: z.object({
          issue: z.number().optional().describe("Issue number"),
          owner: z.string().optional().describe("Repository owner"),
          repo: z.string().optional().describe("Repository name"),
          url: z.string().optional().describe("Full GitHub issue URL"),
        }),
        title: "view_issue",
      },
      list_repo_history: {
        description:
          "List previously used repositories from history. Useful when user mentions 'my repos' or wants to reuse repos.",
        execute: async ({ owner, limit }) => {
          const startTime = Date.now();
          const items = await listRepoHistory(limit ?? 50);
          const filtered = owner
            ? items.filter(
                (item) => item.owner.toLowerCase() === owner.toLowerCase()
              )
            : items;
          const duration = Date.now() - startTime;
          toolTimings.set("list_repo_history", duration);
          return {
            repos: filtered.map((item) => ({
              branch: item.branch,
              lastUsed: item.lastUsed,
              name: item.name,
              owner: item.owner,
              spec: item.spec,
              timesUsed: item.timesUsed,
            })),
          };
        },
        inputSchema: z.object({
          limit: z
            .number()
            .optional()
            .describe("Maximum number of results to return"),
          owner: z
            .string()
            .optional()
            .describe("Filter by repository owner/organization"),
        }),
        title: "list_repo_history",
      },
    };

    const result = streamText({
      maxSteps: 100,
      model: "moonshotai/kimi-k2.5",
      prompt,
      temperature: 0.7,
      tools,
    } as any);

    let response = "";
    const toolResults: ToolCallResult[] = [];

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-delta": {
          const text = (chunk as any).text ?? (chunk as any).textDelta ?? "";
          response += text;
          onChunk(text);
          break;
        }
        case "tool-call": {
          // Tool is being called - show indicator to user
          onChunk(`\n[${chunk.toolName}...]\n`);
          break;
        }
        case "tool-result": {
          const durationMs = toolTimings.get(chunk.toolName) || 0;
          const chunkAny = chunk as any;
          toolResults.push({
            durationMs,
            input: chunkAny.input ?? chunkAny.args,
            output: chunkAny.output ?? chunkAny.result,
            toolName: chunk.toolName,
          });
          break;
        }
        case "error": {
          console.error("Stream error:", chunk.error);
          break;
        }
        default:
          // Ignore other chunk types
          break;
      }
    }

    response = response.trim();

    return {
      response,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
    };
  } catch (llmError) {
    return {
      error: `LLM error: ${llmError instanceof Error ? llmError.message : String(llmError)}`,
      response: "",
    };
  }
}
