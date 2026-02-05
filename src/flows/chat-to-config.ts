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
// Helper functions
// ============================================================================

interface ValidationResult {
  error?: string;
  success: boolean;
}

async function validateRepoOnGitHub(
  repoPath: string
): Promise<ValidationResult> {
  const validationProc = Bun.spawn(
    ["gh", "repo", "view", repoPath, "--json", "nameWithOwner"],
    {
      stderr: "pipe",
      stdout: "pipe",
    }
  );

  const validationOutput = await new Response(validationProc.stdout).text();
  const validationStderr = await new Response(validationProc.stderr).text();

  if (validationStderr && !validationOutput) {
    return {
      error: `Repository '${repoPath}' not found on GitHub. Please check the owner and repository name.`,
      success: false,
    };
  }

  return { success: true };
}

async function validateBranchExists(
  repoPath: string,
  branch: string
): Promise<ValidationResult> {
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
    return {
      error: `Branch '${branch}' not found in repository '${repoPath}'.`,
      success: false,
    };
  }

  return { success: true };
}

interface RepoIssueInfo {
  error?: string;
  issueNumber: number;
  repoPath: string;
}

function parseIssueUrl(url: string): RepoIssueInfo | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match || !match[1] || !match[2] || !match[3]) {
    return null;
  }
  return {
    issueNumber: Number.parseInt(match[3], 10),
    repoPath: `${match[1]}/${match[2]}`,
  };
}

function parseIssueInput(
  url: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  issue: number | undefined
): RepoIssueInfo {
  if (url) {
    const parsed = parseIssueUrl(url);
    if (!parsed) {
      return {
        error: "Invalid GitHub issue URL",
        issueNumber: 0,
        repoPath: "",
      };
    }
    return parsed;
  }

  if (owner && repo && issue) {
    return { issueNumber: issue, repoPath: `${owner}/${repo}` };
  }

  return {
    error: "Provide either a URL or owner/repo/issue",
    issueNumber: 0,
    repoPath: "",
  };
}

interface IssueData {
  author?: { login?: string };
  body?: string;
  comments?: unknown[];
  createdAt: string;
  labels?: { name: string }[];
  state: string;
  title: string;
  url: string;
}

interface FormattedIssue {
  error?: string;
  markdown: string;
  repoPath?: string;
  state?: string;
  title?: string;
  url?: string;
}

function formatIssueMarkdown(
  data: IssueData,
  repoPath: string,
  issueNumber: number
): FormattedIssue {
  const labels = data.labels?.map((l) => l.name).join(", ") || "None";
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

  return {
    markdown,
    repoPath,
    state: data.state,
    title: data.title,
    url: data.url,
  };
}

function parseRepoInput(repo: string): {
  branch: string | undefined;
  repoPath: string;
} {
  if (repo.includes(":")) {
    const parts = repo.split(":");
    return { branch: parts[1], repoPath: parts[0] ?? repo };
  }
  return { branch: undefined, repoPath: repo };
}

function createAddRepoErrorResponse(
  error: string | undefined,
  repos: string[],
  duration: number,
  toolTimings: Map<string, number>
): unknown {
  toolTimings.set("add_repo", duration);
  return { currentRepos: repos, error, success: false };
}

function createAddRepoSuccessResponse(
  repo: string,
  repos: string[],
  added: boolean,
  duration: number,
  toolTimings: Map<string, number>
): unknown {
  toolTimings.set("add_repo", duration);
  return {
    currentRepos: repos,
    message: added ? `Added ${repo}` : `${repo} already in config`,
    success: added,
  };
}

function buildGhListArgs(
  owner: string,
  limit: number | undefined,
  topic: string | undefined
): string[] {
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
  return args;
}

function buildGhIssueArgs(issueNumber: number, repoPath: string): string[] {
  return [
    "gh",
    "issue",
    "view",
    String(issueNumber),
    "--repo",
    repoPath,
    "--json",
    "title,body,state,author,labels,createdAt,comments,url",
  ];
}

// ============================================================================
// INCREMENTAL CHAT MODE
// ============================================================================

export interface IncrementalChatResult {
  response: string;
  toolResults?: ToolCallResult[];
  error?: string;
}

interface TextDeltaChunk {
  text?: string;
  textDelta?: string;
  type: "text-delta";
}

interface ToolCallChunk {
  toolName: string;
  type: "tool-call";
}

interface ToolResultChunk {
  toolName: string;
  type: "tool-result";
  [key: string]: unknown;
}

interface ErrorChunk {
  error: unknown;
  type: "error";
}

type StreamChunk =
  | TextDeltaChunk
  | ToolCallChunk
  | ToolResultChunk
  | ErrorChunk
  | { type: string };

// Tool execute functions
async function checkBranch(
  repoPath: string,
  branch: string,
  repos: string[],
  startTime: number,
  toolTimings: Map<string, number>
): Promise<unknown | null> {
  const branchValidation = await validateBranchExists(repoPath, branch);
  if (!branchValidation.success) {
    return createAddRepoErrorResponse(
      branchValidation.error,
      repos,
      Date.now() - startTime,
      toolTimings
    );
  }
  return null;
}

async function executeAddRepo(
  repo: string,
  configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): Promise<unknown> {
  const startTime = Date.now();
  const { branch, repoPath, repos } = {
    ...parseRepoInput(repo),
    repos: configBuilder.config.repos,
  };

  const repoValidation = await validateRepoOnGitHub(repoPath);
  if (!repoValidation.success) {
    return createAddRepoErrorResponse(
      repoValidation.error,
      repos,
      Date.now() - startTime,
      toolTimings
    );
  }

  if (branch) {
    const branchError = await checkBranch(
      repoPath,
      branch,
      repos,
      startTime,
      toolTimings
    );
    if (branchError) {
      return branchError;
    }
  }

  return createAddRepoSuccessResponse(
    repo,
    repos,
    configBuilder.addRepo(repo),
    Date.now() - startTime,
    toolTimings
  );
}

function executeAddSkill(
  skill: string,
  configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): unknown {
  const startTime = Date.now();
  const added = configBuilder.addSkill(skill);
  const duration = Date.now() - startTime;
  toolTimings.set("add_skill", duration);
  return {
    currentSkills: configBuilder.config.skills,
    message: added ? `Added skill ${skill}` : `${skill} already in config`,
    success: added,
  };
}

function executeSetGoal(
  goal: string,
  _configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): unknown {
  const startTime = Date.now();
  _configBuilder.setGoal(goal);
  const duration = Date.now() - startTime;
  toolTimings.set("set_goal", duration);
  return { message: `Goal set to: ${goal}`, success: true };
}

async function executeListRepos(
  owner: string,
  limit: number | undefined,
  topic: string | undefined,
  toolTimings: Map<string, number>
): Promise<unknown> {
  const startTime = Date.now();
  const args = buildGhListArgs(owner, limit, topic);
  const proc = Bun.spawn(["gh", ...args], { stderr: "pipe", stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  const result = { repos: output.trim().split("\n").filter(Boolean) };
  toolTimings.set("list_repos", Date.now() - startTime);
  return result;
}

async function fetchIssueData(
  issueNumber: number,
  repoPath: string
): Promise<{ output: string; stderr: string }> {
  const args = buildGhIssueArgs(issueNumber, repoPath);
  const proc = Bun.spawn(args, { stderr: "pipe", stdout: "pipe" });
  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { output, stderr };
}

async function parseAndFetchIssue(
  url: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  issue: number | undefined
): Promise<{
  error?: string;
  output?: string;
  repoPath?: string;
  issueNumber?: number;
}> {
  const parsed = parseIssueInput(url, owner, repo, issue);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const { output, stderr } = await fetchIssueData(
    parsed.issueNumber,
    parsed.repoPath
  );
  if (stderr && !output) {
    return { error: stderr.trim() };
  }

  return { issueNumber: parsed.issueNumber, output, repoPath: parsed.repoPath };
}

function formatIssueResult(
  output: string,
  repoPath: string,
  issueNumber: number,
  startTime: number,
  toolTimings: Map<string, number>
): unknown {
  try {
    const data = JSON.parse(output) as IssueData;
    const result = formatIssueMarkdown(data, repoPath, issueNumber);
    toolTimings.set("view_issue", Date.now() - startTime);
    return result;
  } catch {
    return { error: "Failed to parse issue data", markdown: "" };
  }
}

async function executeViewIssue(
  url: string | undefined,
  owner: string | undefined,
  repo: string | undefined,
  issue: number | undefined,
  toolTimings: Map<string, number>
): Promise<unknown> {
  const startTime = Date.now();
  const { error, output, repoPath, issueNumber } = await parseAndFetchIssue(
    url,
    owner,
    repo,
    issue
  );

  if (error || !output || !repoPath || !issueNumber) {
    return { error: error ?? "Failed to fetch issue", markdown: "" };
  }

  return formatIssueResult(
    output,
    repoPath,
    issueNumber,
    startTime,
    toolTimings
  );
}

async function executeListRepoHistory(
  owner: string | undefined,
  limit: number | undefined,
  toolTimings: Map<string, number>
): Promise<unknown> {
  const startTime = Date.now();
  const items = await listRepoHistory(limit ?? 50);
  const filtered = owner
    ? items.filter((item) => item.owner.toLowerCase() === owner.toLowerCase())
    : items;
  toolTimings.set("list_repo_history", Date.now() - startTime);
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
}

// Stream processing helpers
function handleTextDelta(
  chunk: TextDeltaChunk,
  response: string,
  onChunk: (chunk: string) => void
): string {
  const text = chunk.text ?? chunk.textDelta ?? "";
  onChunk(text);
  return response + text;
}

function handleToolCall(
  chunk: ToolCallChunk,
  onChunk: (chunk: string) => void
): void {
  onChunk(`\n[${chunk.toolName}...]\n`);
}

function handleToolResult(
  chunk: ToolResultChunk,
  toolResults: ToolCallResult[],
  toolTimings: Map<string, number>
): void {
  const durationMs = toolTimings.get(chunk.toolName) || 0;
  toolResults.push({
    durationMs,
    input: chunk.input ?? chunk.args,
    output: chunk.output ?? chunk.result,
    toolName: chunk.toolName,
  });
}

function handleErrorChunk(chunk: ErrorChunk): void {
  console.error("Stream error:", chunk.error);
}

function processChunk(
  chunk: StreamChunk,
  response: string,
  toolResults: ToolCallResult[],
  toolTimings: Map<string, number>,
  onChunk: (chunk: string) => void
): string {
  switch (chunk.type) {
    case "text-delta": {
      return handleTextDelta(chunk as TextDeltaChunk, response, onChunk);
    }
    case "tool-call": {
      handleToolCall(chunk as ToolCallChunk, onChunk);
      return response;
    }
    case "tool-result": {
      handleToolResult(chunk as ToolResultChunk, toolResults, toolTimings);
      return response;
    }
    case "error": {
      handleErrorChunk(chunk as ErrorChunk);
      return response;
    }
    default: {
      return response;
    }
  }
}

// ============================================================================
// Main function
// ============================================================================

function buildAddRepoTool(
  configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): ToolSet["add_repo"] {
  return {
    description: "Add a repository to the workspace configuration",
    execute: ({ repo }: { repo: string }) =>
      executeAddRepo(repo, configBuilder, toolTimings),
    inputSchema: z.object({
      repo: z
        .string()
        .describe("Repository in format owner/repo or owner/repo:branch"),
    }),
    title: "add_repo",
  };
}

function buildAddSkillTool(
  configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): ToolSet["add_skill"] {
  return {
    description: "Add a skill or package to install in the workspace",
    execute: ({ skill }: { skill: string }) =>
      executeAddSkill(skill, configBuilder, toolTimings),
    inputSchema: z.object({
      skill: z.string().describe("Skill or package name to install"),
    }),
    title: "add_skill",
  };
}

function buildListRepoHistoryTool(
  toolTimings: Map<string, number>
): ToolSet["list_repo_history"] {
  return {
    description: "List previously used repositories from history",
    execute: ({ limit, owner }: { limit?: number; owner?: string }) =>
      executeListRepoHistory(owner, limit, toolTimings),
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
  };
}

function buildListReposTool(
  toolTimings: Map<string, number>
): ToolSet["list_repos"] {
  return {
    description: "List all repositories for a given owner/organization",
    execute: ({
      limit,
      owner,
      topic,
    }: {
      limit?: number;
      owner: string;
      topic?: string;
    }) => executeListRepos(owner, limit, topic, toolTimings),
    inputSchema: z.object({
      limit: z.number().optional(),
      owner: z.string(),
      topic: z.string().optional(),
    }),
    title: "list_repos",
  };
}

function buildSetGoalTool(
  configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): ToolSet["set_goal"] {
  return {
    description: "Set the goal/purpose for this workspace session",
    execute: ({ goal }: { goal: string }) =>
      executeSetGoal(goal, configBuilder, toolTimings),
    inputSchema: z.object({
      goal: z
        .string()
        .describe("Brief description of what the user wants to accomplish"),
    }),
    title: "set_goal",
  };
}

function buildViewIssueTool(
  toolTimings: Map<string, number>
): ToolSet["view_issue"] {
  return {
    description: "View a GitHub issue",
    execute: ({
      issue,
      owner,
      repo,
      url,
    }: {
      issue?: number;
      owner?: string;
      repo?: string;
      url?: string;
    }) => executeViewIssue(url, owner, repo, issue, toolTimings),
    inputSchema: z.object({
      issue: z.number().optional().describe("Issue number"),
      owner: z.string().optional().describe("Repository owner"),
      repo: z.string().optional().describe("Repository name"),
      url: z.string().optional().describe("Full GitHub issue URL"),
    }),
    title: "view_issue",
  };
}

function buildTools(
  configBuilder: ConfigBuilder,
  toolTimings: Map<string, number>
): ToolSet {
  return {
    add_repo: buildAddRepoTool(configBuilder, toolTimings),
    add_skill: buildAddSkillTool(configBuilder, toolTimings),
    list_repo_history: buildListRepoHistoryTool(toolTimings),
    list_repos: buildListReposTool(toolTimings),
    set_goal: buildSetGoalTool(configBuilder, toolTimings),
    view_issue: buildViewIssueTool(toolTimings),
  };
}

async function processStream(
  result: ReturnType<typeof streamText>,
  toolTimings: Map<string, number>,
  onChunk: (chunk: string) => void
): Promise<{ response: string; toolResults: ToolCallResult[] }> {
  let response = "";
  const toolResults: ToolCallResult[] = [];

  for await (const chunk of result.fullStream as AsyncIterable<StreamChunk>) {
    response = processChunk(chunk, response, toolResults, toolTimings, onChunk);
  }

  return { response: response.trim(), toolResults };
}

function buildPrompt(messages: ChatMessage[]): string {
  const context = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const userMessage =
    messages.findLast((m) => m.role === "user")?.content ?? "";
  return INCREMENTAL_CHAT_PROMPT.replace("{{context}}", context).replace(
    "{{userMessage}}",
    userMessage
  );
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
  const repoHistory = await generateRepoHistorySection();
  const prompt = buildPrompt(messages).replace("{{repoHistory}}", repoHistory);
  const toolTimings = new Map<string, number>();
  const tools = buildTools(configBuilder, toolTimings);

  try {
    const result = streamText({
      model: "moonshotai/kimi-k2.5" as unknown as Parameters<
        typeof streamText
      >[0]["model"],
      prompt,
      temperature: 0.7,
      tools,
    });

    const { response, toolResults } = await processStream(
      result,
      toolTimings,
      onChunk
    );

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
