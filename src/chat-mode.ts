import type { CliRenderer } from "@opentui/core";

import { once } from "node:events";

import type { Session } from "./types";

import { ChatLogger } from "./chat-logger";
import { ConfigBuilder } from "./config-builder";
import { createNewSession } from "./flows";
import {
  type ChatConfig,
  type ChatMessage,
  type ToolCallResult,
  chatToConfigIncremental,
  configToRepoSpecs,
} from "./flows/chat-to-config";
import {
  INCREMENTAL_WELCOME_MESSAGE,
  API_KEY_MISSING_MESSAGE,
} from "./prompts/chat-prompt";
import { showChatConfirmation } from "./ui/chat-confirmation";
import {
  createChatWithSidebarLayout,
  createStreamingMessage,
  waitForChatInput,
  type ChatWithSidebarElements,
} from "./ui/chat-with-sidebar";
import { createRenderer, destroyRenderer } from "./ui/renderer";

function formatViewIssueResult(tr: ToolCallResult): string | null {
  const output = tr.output as {
    markdown?: string;
    error?: string;
    title?: string;
  };
  if (output.error) {
    return `Failed to fetch issue: ${output.error}`;
  }
  if (output.markdown) {
    return output.markdown;
  }
  return null;
}

function formatListReposResult(tr: ToolCallResult): string | null {
  const output = tr.output as { repos?: string[] };
  if (output.repos && output.repos.length > 0) {
    return `Found repositories:\n${output.repos.map((r) => `- ${r}`).join("\n")}`;
  }
  return null;
}

function formatListRepoHistoryResult(tr: ToolCallResult): string | null {
  const output = tr.output as { repos?: { spec: string }[] };
  if (output.repos && output.repos.length > 0) {
    return `Repositories from history:\n${output.repos.map((r) => `- ${r.spec}`).join("\n")}`;
  }
  return null;
}

/**
 * Format a tool result for inclusion in the conversation history
 */
function formatToolResultForMessage(tr: ToolCallResult): string | null {
  switch (tr.toolName) {
    case "view_issue": {
      return formatViewIssueResult(tr);
    }
    case "list_repos": {
      return formatListReposResult(tr);
    }
    case "list_repo_history": {
      return formatListRepoHistoryResult(tr);
    }
    default: {
      break;
    }
  }
  return null;
}

export interface ChatModeResult {
  session?: Session;
  cancelled: boolean;
  useManualMode: boolean;
  logPath?: string;
}

function createStreamHandler(
  elements: ChatWithSidebarElements,
  streaming: ReturnType<typeof createStreamingMessage>
) {
  return (chunk: string) => {
    elements.hideCooking();
    streaming.update(chunk);
  };
}

function handleToolResults(
  toolResults: ToolCallResult[],
  messages: ChatMessage[],
  logger: ChatLogger
): void {
  for (const tr of toolResults) {
    logger.addToolCall(tr.toolName, tr.input, tr.output, tr.durationMs);
    const toolOutput = formatToolResultForMessage(tr);
    if (toolOutput) {
      messages.push({ content: toolOutput, role: "assistant" });
      logger.addMessage("assistant", toolOutput);
    }
  }
}

function handleLLMResponse(
  chatResult: {
    response?: string;
    error?: string;
  },
  messages: ChatMessage[],
  logger: ChatLogger
): void {
  if (chatResult.response) {
    messages.push({ content: chatResult.response, role: "assistant" });
    logger.addMessage("assistant", chatResult.response);
  }

  if (chatResult.error) {
    logger.addError("llm", chatResult.error);
    const errorMessage = "Sorry, I encountered an error. Please try again.";
    messages.push({ content: errorMessage, role: "assistant" });
    logger.addMessage("assistant", errorMessage);
  }
}

async function processLLMConversationTurn(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger
): Promise<void> {
  const streaming = createStreamingMessage(renderer, elements);
  const streamHandler = createStreamHandler(elements, streaming);
  const chatResult = await chatToConfigIncremental(
    messages,
    configBuilder,
    streamHandler
  );

  elements.hideCooking();
  streaming.finish();

  if (chatResult.toolResults) {
    handleToolResults(chatResult.toolResults, messages, logger);
  }

  handleLLMResponse(chatResult, messages, logger);
}

async function checkApiKey(): Promise<ChatModeResult> {
  console.clear();
  console.log(API_KEY_MISSING_MESSAGE);
  await waitForEnter();
  return { cancelled: false, useManualMode: true };
}

async function handleConfirmationResult(
  confirmResult: { action: string },
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger,
  _renderer: CliRenderer
): Promise<ChatModeResult | undefined> {
  const handlers = {
    back: async () => {
      const reviseMessage = "Let me revise further.";
      messages.push({ content: reviseMessage, role: "user" });
      logger.addMessage("user", reviseMessage);

      destroyRenderer();
      const activeRenderer = await createRenderer();

      return await continueChatAfterBack(
        activeRenderer,
        messages,
        configBuilder,
        logger
      );
    },
    cancel: async () => {
      destroyRenderer();
      logger.markCancelled();
      const logPath = await logger.save();
      return { cancelled: true, logPath, useManualMode: false };
    },
    edit: async () => {
      destroyRenderer();
      logger.markCancelled();
      const logPath = await logger.save();
      return { cancelled: false, logPath, useManualMode: true };
    },
  };

  const handler = handlers[confirmResult.action as keyof typeof handlers];
  if (handler) {
    return await handler();
  }

  destroyRenderer();
  return undefined;
}

function isReadyAndHasRepos(
  userMessage: string,
  configBuilder: ConfigBuilder
): boolean {
  return isReadySignal(userMessage) && configBuilder.isReady();
}

function isReadyButNoRepos(
  userMessage: string,
  configBuilder: ConfigBuilder
): boolean {
  return isReadySignal(userMessage) && !configBuilder.isReady();
}

function handleReadyWithNoRepos(
  userMessage: string,
  messages: ChatMessage[],
  logger: ChatLogger
): void {
  messages.push({ content: userMessage, role: "user" });
  logger.addMessage("user", userMessage);

  const needRepoMessage =
    "I need at least one repository before we can proceed. What would you like to work on?";
  messages.push({ content: needRepoMessage, role: "assistant" });
  logger.addMessage("assistant", needRepoMessage);
}

async function handleUserMessage(
  userMessage: string,
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger,
  renderer: CliRenderer,
  elements: ChatWithSidebarElements
): Promise<boolean> {
  if (isReadyAndHasRepos(userMessage, configBuilder)) {
    messages.push({ content: userMessage, role: "user" });
    logger.addMessage("user", userMessage);
    return true;
  }

  if (isReadyButNoRepos(userMessage, configBuilder)) {
    handleReadyWithNoRepos(userMessage, messages, logger);
    return false;
  }

  await handleRegularMessage(
    userMessage,
    messages,
    logger,
    renderer,
    elements,
    configBuilder
  );
  return false;
}

async function handleRegularMessage(
  userMessage: string,
  messages: ChatMessage[],
  logger: ChatLogger,
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  configBuilder: ConfigBuilder
): Promise<void> {
  messages.push({ content: userMessage, role: "user" });
  logger.addMessage("user", userMessage);

  await processLLMConversationTurn(
    renderer,
    elements,
    messages,
    configBuilder,
    logger
  );
}

async function runChatIteration(
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger,
  renderer: CliRenderer
): Promise<boolean> {
  const elements = createChatWithSidebarLayout(
    renderer,
    messages,
    configBuilder.config
  );

  const inputResult = await waitForChatInput(renderer, elements, messages);

  if (inputResult.cancelled) {
    throw new Error("cancelled");
  }

  if (!inputResult.message.trim()) {
    return false;
  }

  return await handleUserMessage(
    inputResult.message.trim(),
    messages,
    configBuilder,
    logger,
    renderer,
    elements
  );
}

async function runMainChatLoop(
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger,
  renderer: CliRenderer
): Promise<void> {
  while (true) {
    const isReady = await runChatIteration(
      messages,
      configBuilder,
      logger,
      renderer
    );
    if (isReady) {
      return;
    }
  }
}

/**
 * Check if user message indicates they're ready to proceed
 */
function isReadySignal(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const readySignals = [
    "ready",
    "done",
    "let's go",
    "lets go",
    "proceed",
    "start",
    "continue",
    "go",
  ];
  return readySignals.some(
    (signal) => normalized === signal || normalized.startsWith(`${signal} `)
  );
}

async function handleChatConfirmation(
  configBuilder: ConfigBuilder,
  logger: ChatLogger,
  renderer: CliRenderer,
  messages: ChatMessage[]
): Promise<ChatModeResult> {
  const config = configBuilder.toFinalConfig();
  logger.addConfigAttempt(config, true);

  const confirmResult = await showChatConfirmation(renderer, config);
  const result = await handleConfirmationResult(
    confirmResult,
    messages,
    configBuilder,
    logger,
    renderer
  );

  if (result !== undefined) {
    return result;
  }

  destroyRenderer();
  return await createSessionFromConfig(config, logger);
}

async function handleChatError(
  logger: ChatLogger,
  error: unknown
): Promise<ChatModeResult> {
  destroyRenderer();
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.addError("llm", errorMessage);
  console.error("Chat mode error:", error);
  const logPath = await logger.save();
  return { cancelled: true, logPath, useManualMode: false };
}

async function setupChatSession(
  logger: ChatLogger,
  configBuilder: ConfigBuilder
): Promise<ChatModeResult> {
  const renderer = await createRenderer();
  const messages: ChatMessage[] = [];

  try {
    messages.push({ content: INCREMENTAL_WELCOME_MESSAGE, role: "assistant" });
    logger.addMessage("assistant", INCREMENTAL_WELCOME_MESSAGE);

    await runMainChatLoop(messages, configBuilder, logger, renderer);

    destroyRenderer();

    const activeRenderer = await createRenderer();

    return await handleChatConfirmation(
      configBuilder,
      logger,
      activeRenderer,
      messages
    );
  } catch (error) {
    return await handleChatError(logger, error);
  }
}

export async function handleChatMode(): Promise<ChatModeResult> {
  const logger = new ChatLogger();
  const configBuilder = new ConfigBuilder();

  if (!process.env.AI_GATEWAY_API_KEY) {
    return await checkApiKey();
  }

  return await setupChatSession(logger, configBuilder);
}

/**
 * Continue chat after user goes back from confirmation
 */
async function continueChatAfterBack(
  initialRenderer: CliRenderer,
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger
): Promise<ChatModeResult> {
  let activeRenderer: CliRenderer = initialRenderer;

  await runMainChatLoop(messages, configBuilder, logger, activeRenderer);

  const config = configBuilder.toFinalConfig();
  logger.addConfigAttempt(config, true);

  const confirmResult = await showChatConfirmation(activeRenderer, config);
  const result = await handleConfirmationResult(
    confirmResult,
    messages,
    configBuilder,
    logger,
    activeRenderer
  );

  if (result !== undefined) {
    return result;
  }

  return await createSessionFromConfig(config, logger);
}

async function handleNoValidRepos(logger: ChatLogger): Promise<ChatModeResult> {
  logger.addError("validation", "No valid repositories found in configuration");
  const logPath = await logger.save();
  console.error("No valid repositories found in configuration.");
  return { cancelled: true, logPath, useManualMode: false };
}

async function handleSessionError(
  logger: ChatLogger,
  error: unknown
): Promise<ChatModeResult> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.addError("llm", errorMessage);
  console.error("Failed to create session:", error);
  const logPath = await logger.save();
  return { cancelled: true, logPath, useManualMode: false };
}

async function runSessionCreation(
  config: ChatConfig,
  repos: Awaited<ReturnType<typeof configToRepoSpecs>>,
  logger: ChatLogger
): Promise<ChatModeResult> {
  const renderer = await createRenderer();

  const result = await createNewSession(renderer, {
    goal: config.goal || undefined,
    mode: "tui",
    repos,
    skills: config.skills.length > 0 ? config.skills : undefined,
  });

  destroyRenderer();

  if (!result) {
    logger.markCancelled();
    const logPath = await logger.save();
    return { cancelled: true, logPath, useManualMode: false };
  }

  logger.markSessionCreated(result.session.name, {
    goal: config.goal,
    repos: config.repos,
    skills: config.skills,
  });
  const logPath = await logger.save();

  return {
    cancelled: false,
    logPath,
    session: result.session,
    useManualMode: false,
  };
}

async function createSessionFromConfig(
  config: ChatConfig,
  logger: ChatLogger
): Promise<ChatModeResult> {
  try {
    const repos = configToRepoSpecs(config);

    if (repos.length === 0) {
      return await handleNoValidRepos(logger);
    }

    return await runSessionCreation(config, repos, logger);
  } catch (error) {
    return await handleSessionError(logger, error);
  }
}

async function waitForEnter(): Promise<void> {
  process.stdin.setRawMode(true);
  process.stdin.resume();

  await once(process.stdin, "data");

  process.stdin.setRawMode(false);
  process.stdin.pause();
}
