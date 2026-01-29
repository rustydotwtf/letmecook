import { createRenderer, destroyRenderer } from "./ui/renderer";
import { showChatConfirmation } from "./ui/chat-confirmation";
import {
  createChatWithSidebarLayout,
  updateSidebar,
  createStreamingMessage,
  waitForChatInput,
  type ChatWithSidebarElements,
} from "./ui/chat-with-sidebar";
import {
  chatToConfigIncremental,
  configToRepoSpecs,
  type ChatMessage,
} from "./flows/chat-to-config";
import { createNewSession } from "./flows";
import type { ChatConfig } from "./flows/chat-to-config";
import type { Session } from "./types";
import { INCREMENTAL_WELCOME_MESSAGE, API_KEY_MISSING_MESSAGE } from "./prompts/chat-prompt";
import { ChatLogger } from "./chat-logger";
import { ConfigBuilder } from "./config-builder";
import type { ToolCallResult } from "./flows/chat-to-config";

/**
 * Format a tool result for inclusion in the conversation history
 */
function formatToolResultForMessage(tr: ToolCallResult): string | null {
  switch (tr.toolName) {
    case "view_issue": {
      const output = tr.output as { markdown?: string; error?: string; title?: string };
      if (output.error) {
        return `Failed to fetch issue: ${output.error}`;
      }
      if (output.markdown) {
        return output.markdown;
      }
      break;
    }
    case "list_repos": {
      const output = tr.output as { repos?: string[] };
      if (output.repos && output.repos.length > 0) {
        return `Found repositories:\n${output.repos.map((r) => `- ${r}`).join("\n")}`;
      }
      break;
    }
    case "list_repo_history": {
      const output = tr.output as { repos?: { spec: string }[] };
      if (output.repos && output.repos.length > 0) {
        return `Repositories from history:\n${output.repos.map((r) => `- ${r.spec}`).join("\n")}`;
      }
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
    (signal) => normalized === signal || normalized.startsWith(signal + " "),
  );
}

export async function handleChatMode(): Promise<ChatModeResult> {
  const logger = new ChatLogger();
  const configBuilder = new ConfigBuilder();

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.clear();
    console.log(API_KEY_MISSING_MESSAGE);
    await waitForEnter();
    logger.markCancelled();
    await logger.save();
    return { cancelled: false, useManualMode: true };
  }

  let renderer = await createRenderer();
  const messages: ChatMessage[] = [];

  try {
    // Add welcome message
    messages.push({ role: "assistant", content: INCREMENTAL_WELCOME_MESSAGE });
    logger.addMessage("assistant", INCREMENTAL_WELCOME_MESSAGE);

    let elements: ChatWithSidebarElements;
    let confirmed = false;

    // Subscribe to config changes for sidebar updates
    configBuilder.on("config-changed", (config) => {
      if (elements) {
        updateSidebar(renderer, elements, config);
      }
    });

    while (!confirmed) {
      // Create/refresh the layout
      elements = createChatWithSidebarLayout(renderer, messages, configBuilder.config);

      // Wait for user input
      const inputResult = await waitForChatInput(renderer, elements, messages);

      if (inputResult.cancelled) {
        destroyRenderer();
        logger.markCancelled();
        const logPath = await logger.save();
        return { cancelled: true, useManualMode: false, logPath };
      }

      if (!inputResult.message.trim()) {
        continue;
      }

      const userMessage = inputResult.message.trim();

      // Check if user is ready (and config is valid)
      if (isReadySignal(userMessage) && configBuilder.isReady()) {
        // Add final message and break to confirmation
        messages.push({ role: "user", content: userMessage });
        logger.addMessage("user", userMessage);
        break;
      }

      // If user says ready but no repos, tell them
      if (isReadySignal(userMessage) && !configBuilder.isReady()) {
        messages.push({ role: "user", content: userMessage });
        logger.addMessage("user", userMessage);

        const needRepoMessage =
          "I need at least one repository before we can proceed. What would you like to work on?";
        messages.push({ role: "assistant", content: needRepoMessage });
        logger.addMessage("assistant", needRepoMessage);
        continue;
      }

      // Add user message
      messages.push({ role: "user", content: userMessage });
      logger.addMessage("user", userMessage);

      // Refresh layout to show user message
      destroyRenderer();
      renderer = await createRenderer();
      elements = createChatWithSidebarLayout(renderer, messages, configBuilder.config);

      // Show cooking indicator while waiting for LLM
      elements.showCooking();

      // Create streaming message area
      const streaming = createStreamingMessage(renderer, elements);

      // Process with LLM
      const chatResult = await chatToConfigIncremental(messages, configBuilder, (chunk) => {
        // Hide cooking indicator on first chunk
        elements.hideCooking();
        streaming.update(chunk);
      });

      // Hide cooking indicator if it wasn't hidden yet (e.g., empty response)
      elements.hideCooking();

      streaming.finish();

      // Log tool calls and add results to conversation history
      if (chatResult.toolResults) {
        for (const tr of chatResult.toolResults) {
          logger.addToolCall(tr.toolName, tr.input, tr.output, tr.durationMs);
          // Add tool results to messages so LLM can reference them later
          const toolOutput = formatToolResultForMessage(tr);
          if (toolOutput) {
            messages.push({ role: "assistant", content: toolOutput });
            logger.addMessage("assistant", toolOutput);
          }
        }
      }

      // Add assistant response
      if (chatResult.response) {
        messages.push({ role: "assistant", content: chatResult.response });
        logger.addMessage("assistant", chatResult.response);
      }

      if (chatResult.error) {
        logger.addError("llm", chatResult.error);
        const errorMessage = "Sorry, I encountered an error. Please try again.";
        messages.push({ role: "assistant", content: errorMessage });
        logger.addMessage("assistant", errorMessage);
      }

      // Refresh layout with new messages
      destroyRenderer();
      renderer = await createRenderer();
    }

    // Show confirmation screen
    destroyRenderer();
    renderer = await createRenderer();

    const config = configBuilder.toFinalConfig();
    logger.addConfigAttempt(config, true);

    const confirmResult = await showChatConfirmation(renderer, config);

    if (confirmResult.action === "cancel") {
      destroyRenderer();
      logger.markCancelled();
      const logPath = await logger.save();
      return { cancelled: true, useManualMode: false, logPath };
    }

    if (confirmResult.action === "back") {
      // Go back to chat - add a message and continue
      const reviseMessage = "Let me revise what I'm looking for.";
      messages.push({ role: "user", content: reviseMessage });
      logger.addMessage("user", reviseMessage);

      destroyRenderer();
      renderer = await createRenderer();

      // Recursive call to continue the chat loop
      // Reset confirmed state and continue in a new loop
      return await continueChatAfterBack(renderer, messages, configBuilder, logger);
    }

    if (confirmResult.action === "edit") {
      destroyRenderer();
      logger.markCancelled();
      const logPath = await logger.save();
      return { cancelled: false, useManualMode: true, logPath };
    }

    // Confirmed - create session
    destroyRenderer();
    return await createSessionFromConfig(config, logger);
  } catch (error) {
    destroyRenderer();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.addError("llm", errorMessage);
    console.error("Chat mode error:", error);
    const logPath = await logger.save();
    return { cancelled: true, useManualMode: false, logPath };
  }
}

/**
 * Continue chat after user goes back from confirmation
 */
async function continueChatAfterBack(
  renderer: any,
  messages: ChatMessage[],
  configBuilder: ConfigBuilder,
  logger: ChatLogger,
): Promise<ChatModeResult> {
  let elements: ChatWithSidebarElements;

  // Subscribe to config changes
  configBuilder.on("config-changed", (config) => {
    if (elements) {
      updateSidebar(renderer, elements, config);
    }
  });

  while (true) {
    elements = createChatWithSidebarLayout(renderer, messages, configBuilder.config);

    const inputResult = await waitForChatInput(renderer, elements, messages);

    if (inputResult.cancelled) {
      destroyRenderer();
      logger.markCancelled();
      const logPath = await logger.save();
      return { cancelled: true, useManualMode: false, logPath };
    }

    if (!inputResult.message.trim()) {
      continue;
    }

    const userMessage = inputResult.message.trim();

    // Check if user is ready
    if (isReadySignal(userMessage) && configBuilder.isReady()) {
      messages.push({ role: "user", content: userMessage });
      logger.addMessage("user", userMessage);
      break;
    }

    if (isReadySignal(userMessage) && !configBuilder.isReady()) {
      messages.push({ role: "user", content: userMessage });
      logger.addMessage("user", userMessage);

      const needRepoMessage =
        "I need at least one repository before we can proceed. What would you like to work on?";
      messages.push({ role: "assistant", content: needRepoMessage });
      logger.addMessage("assistant", needRepoMessage);
      continue;
    }

    messages.push({ role: "user", content: userMessage });
    logger.addMessage("user", userMessage);

    destroyRenderer();
    renderer = await createRenderer();
    elements = createChatWithSidebarLayout(renderer, messages, configBuilder.config);

    // Show cooking indicator while waiting for LLM
    elements.showCooking();

    const streaming = createStreamingMessage(renderer, elements);

    const chatResult = await chatToConfigIncremental(messages, configBuilder, (chunk) => {
      // Hide cooking indicator on first chunk
      elements.hideCooking();
      streaming.update(chunk);
    });

    // Hide cooking indicator if it wasn't hidden yet
    elements.hideCooking();

    streaming.finish();

    if (chatResult.toolResults) {
      for (const tr of chatResult.toolResults) {
        logger.addToolCall(tr.toolName, tr.input, tr.output, tr.durationMs);
        // Add tool results to messages so LLM can reference them later
        const toolOutput = formatToolResultForMessage(tr);
        if (toolOutput) {
          messages.push({ role: "assistant", content: toolOutput });
          logger.addMessage("assistant", toolOutput);
        }
      }
    }

    if (chatResult.response) {
      messages.push({ role: "assistant", content: chatResult.response });
      logger.addMessage("assistant", chatResult.response);
    }

    if (chatResult.error) {
      logger.addError("llm", chatResult.error);
    }

    destroyRenderer();
    renderer = await createRenderer();
  }

  // Show confirmation again
  destroyRenderer();
  renderer = await createRenderer();

  const config = configBuilder.toFinalConfig();
  logger.addConfigAttempt(config, true);

  const confirmResult = await showChatConfirmation(renderer, config);

  if (confirmResult.action === "cancel") {
    destroyRenderer();
    logger.markCancelled();
    const logPath = await logger.save();
    return { cancelled: true, useManualMode: false, logPath };
  }

  if (confirmResult.action === "back") {
    const reviseMessage = "Let me revise further.";
    messages.push({ role: "user", content: reviseMessage });
    logger.addMessage("user", reviseMessage);

    destroyRenderer();
    renderer = await createRenderer();

    return await continueChatAfterBack(renderer, messages, configBuilder, logger);
  }

  if (confirmResult.action === "edit") {
    destroyRenderer();
    logger.markCancelled();
    const logPath = await logger.save();
    return { cancelled: false, useManualMode: true, logPath };
  }

  destroyRenderer();
  return await createSessionFromConfig(config, logger);
}

async function createSessionFromConfig(
  config: ChatConfig,
  logger: ChatLogger,
): Promise<ChatModeResult> {
  try {
    const repos = configToRepoSpecs(config);

    if (repos.length === 0) {
      logger.addError("validation", "No valid repositories found in configuration");
      const logPath = await logger.save();
      console.error("No valid repositories found in configuration.");
      return { cancelled: true, useManualMode: false, logPath };
    }

    const renderer = await createRenderer();

    const result = await createNewSession(renderer, {
      repos,
      goal: config.goal || undefined,
      skills: config.skills.length > 0 ? config.skills : undefined,
      mode: "tui",
    });

    destroyRenderer();

    if (!result) {
      logger.markCancelled();
      const logPath = await logger.save();
      return { cancelled: true, useManualMode: false, logPath };
    }

    logger.markSessionCreated(result.session.name, {
      repos: config.repos,
      skills: config.skills,
      goal: config.goal,
    });
    const logPath = await logger.save();

    return {
      session: result.session,
      cancelled: false,
      useManualMode: false,
      logPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.addError("llm", errorMessage);
    console.error("Failed to create session:", error);
    const logPath = await logger.save();
    return { cancelled: true, useManualMode: false, logPath };
  }
}

async function waitForEnter(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}
