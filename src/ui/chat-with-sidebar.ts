import {
  ASCIIFontRenderable,
  BoxRenderable,
  type CliRenderer,
  InputRenderable,
  type KeyEvent,
  measureText,
  RGBA,
  ScrollBoxRenderable,
  TextRenderable,
} from "@opentui/core";

import type { PartialConfig } from "../config-builder";
import type { ChatMessage } from "../flows/chat-to-config";

import { copyToClipboard } from "./common/clipboard";
import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape, isKey, isCtrlC } from "./common/keyboard";
import {
  createCookingIndicator,
  type CookingIndicator,
} from "./cooking-indicator";
import { clearLayout } from "./renderer";

export interface ChatWithSidebarElements {
  container: BoxRenderable;
  title: ASCIIFontRenderable;
  mainBox: BoxRenderable;
  chatBox: BoxRenderable;
  chatScrollBox: ScrollBoxRenderable;
  sidebarBox: BoxRenderable;
  inputContainer: BoxRenderable;
  input: InputRenderable;
  // Sidebar elements for updates
  reposContainer: BoxRenderable;
  skillsContainer: BoxRenderable;
  goalText: TextRenderable;
  statusText: TextRenderable;
  // Cooking indicator
  cookingIndicator?: CookingIndicator;
  // Methods
  showCooking: () => void;
  hideCooking: () => void;
}

export interface ChatInputResult {
  message: string;
  cancelled: boolean;
}

/**
 * Create a two-column layout with chat on the left and config sidebar on the right
 */
export function createChatWithSidebarLayout(
  renderer: CliRenderer,
  messages: ChatMessage[],
  config: PartialConfig
): ChatWithSidebarElements {
  clearLayout(renderer);

  const width = renderer.terminalWidth;
  const height = renderer.terminalHeight;

  // Main container
  const container = new BoxRenderable(renderer, {
    alignItems: "center",
    flexDirection: "column",
    height: "100%",
    id: "main-container",
    padding: 1,
    width: "100%",
  });
  renderer.root.add(container);

  // Title
  const titleText = "letmecook";
  const titleFont = "tiny";
  const { width: titleWidth } = measureText({
    font: titleFont,
    text: titleText,
  });
  const centerX = Math.floor(width / 2) - Math.floor(titleWidth / 2);

  const title = new ASCIIFontRenderable(renderer, {
    color: RGBA.fromHex("#f8fafc"),
    font: titleFont,
    id: "title",
    left: centerX,
    position: "absolute",
    text: titleText,
    top: 11,
  });
  renderer.root.add(title);

  // Calculate widths
  const totalWidth = Math.min(100, width - 4);
  const chatWidth = Math.floor(totalWidth * 0.62);
  const sidebarWidth = totalWidth - chatWidth - 1; // -1 for gap

  // Main horizontal box containing chat and sidebar
  const mainBox = new BoxRenderable(renderer, {
    flexDirection: "row",
    gap: 1,
    id: "content",
    marginTop: 15,
    width: totalWidth,
  });
  container.add(mainBox);

  // === LEFT: Chat Box ===
  const chatBox = new BoxRenderable(renderer, {
    backgroundColor: "#1e293b",
    borderColor: "#475569",
    borderStyle: "single",
    flexDirection: "column",
    height: Math.max(16, height - 22),
    id: "chat-box",
    padding: 1,
    width: chatWidth,
  });
  mainBox.add(chatBox);

  // Chat header
  const chatHeader = new TextRenderable(renderer, {
    content: "Chat",
    fg: "#94a3b8",
    id: "chat-header",
    marginBottom: 1,
  });
  chatBox.add(chatHeader);

  // Chat scrollable area
  const chatScrollBox = new ScrollBoxRenderable(renderer, {
    backgroundColor: "transparent",
    border: false,
    height: Math.max(8, height - 32),
    id: "chat-scrollbox",
    scrollX: false,
    scrollY: true,
    stickyScroll: true,
    stickyStart: "bottom",
    width: chatWidth - 4,
  });
  chatBox.add(chatScrollBox);

  // Add existing messages
  for (const [index, msg] of messages.entries()) {
    const prefix = msg.role === "user" ? "\u{1F464}" : "\u{1F916}";
    const fg = msg.role === "user" ? "#e2e8f0" : "#94a3b8";

    const messageText = new TextRenderable(renderer, {
      content: `${prefix} ${msg.content}`,
      fg,
      id: `msg-${index}`,
      marginBottom: 1,
      maxWidth: chatWidth - 8,
    });
    chatScrollBox.add(messageText);
  }

  // Input container
  const inputContainer = new BoxRenderable(renderer, {
    flexDirection: "column",
    id: "input-container",
    marginTop: 1,
    width: chatWidth - 4,
  });
  chatBox.add(inputContainer);

  // Input
  const input = new InputRenderable(renderer, {
    backgroundColor: "#334155",
    cursorColor: "#38bdf8",
    height: 1,
    id: "chat-input",
    placeholder: "Type your message...",
    placeholderColor: "#64748b",
    textColor: "#f8fafc",
    width: chatWidth - 6,
  });
  inputContainer.add(input);

  // Enable pasting
  input.onPaste = (event) => {
    const text = event.text.replaceAll(/[\r\n]+/g, "");
    if (!text) {
      return;
    }
    input.insertText(text);
    event.preventDefault();
  };

  // === RIGHT: Sidebar Box ===
  const sidebarBox = new BoxRenderable(renderer, {
    backgroundColor: "#1e293b",
    borderColor: "#475569",
    borderStyle: "single",
    flexDirection: "column",
    height: Math.max(16, height - 22),
    id: "sidebar-box",
    padding: 1,
    width: sidebarWidth,
  });
  mainBox.add(sidebarBox);

  // Sidebar header
  const sidebarHeader = new TextRenderable(renderer, {
    content: "Configuration",
    fg: "#94a3b8",
    id: "sidebar-header",
    marginBottom: 1,
  });
  sidebarBox.add(sidebarHeader);

  // Repositories section
  const reposLabel = new TextRenderable(renderer, {
    content: "\u{1F4E6} Repositories:",
    fg: "#38bdf8",
    id: "repos-label",
    marginBottom: 0,
  });
  sidebarBox.add(reposLabel);

  const reposContainer = new BoxRenderable(renderer, {
    flexDirection: "column",
    id: "repos-container",
    marginBottom: 1,
    marginLeft: 1,
  });
  sidebarBox.add(reposContainer);

  // Skills section
  const skillsLabel = new TextRenderable(renderer, {
    content: "\u{1F6E0}\uFE0F  Skills:",
    fg: "#38bdf8",
    id: "skills-label",
    marginBottom: 0,
    marginTop: 1,
  });
  sidebarBox.add(skillsLabel);

  const skillsContainer = new BoxRenderable(renderer, {
    flexDirection: "column",
    id: "skills-container",
    marginBottom: 1,
    marginLeft: 1,
  });
  sidebarBox.add(skillsContainer);

  // Goal section
  const goalLabel = new TextRenderable(renderer, {
    content: "\u{1F3AF} Goal:",
    fg: "#38bdf8",
    id: "goal-label",
    marginBottom: 0,
    marginTop: 1,
  });
  sidebarBox.add(goalLabel);

  const goalText = new TextRenderable(renderer, {
    content: "(not set)",
    fg: "#64748b",
    id: "goal-text",
    marginBottom: 1,
    marginLeft: 1,
    maxWidth: sidebarWidth - 4,
  });
  sidebarBox.add(goalText);

  // Status
  const statusText = new TextRenderable(renderer, {
    content: 'Status: Waiting for input...\nSay "ready" when done',
    fg: "#64748b",
    id: "status-text",
    marginTop: 2,
  });
  sidebarBox.add(statusText);

  // Create cooking indicator (but don't start it yet)
  const cookingIndicator = createCookingIndicator(renderer, inputContainer);

  // Populate initial config
  const elements: ChatWithSidebarElements = {
    chatBox,
    chatScrollBox,
    container,
    cookingIndicator,
    goalText,
    hideCooking: () => {
      // Hide cooking indicator and re-enable input
      if (cookingIndicator) {
        cookingIndicator.stop();
      }
    },
    input,
    inputContainer,
    mainBox,
    reposContainer,
    showCooking: () => {
      // Disable input and show cooking indicator
      input.blur();
      if (cookingIndicator) {
        cookingIndicator.start();
      }
    },
    sidebarBox,
    skillsContainer,
    statusText,
    title,
  };

  updateSidebar(renderer, elements, config);

  return elements;
}

/**
 * Helper to clear all children from a BoxRenderable
 */
function clearBox(box: BoxRenderable, _renderer: CliRenderer): void {
  // Remove children by attempting to remove known IDs
  // This is a workaround since BoxRenderable doesn't have a clear method
  const idsToTry = [];
  for (let i = 0; i < 50; i += 1) {
    idsToTry.push(`sidebar-repo-${i}`, `sidebar-skill-${i}`);
  }
  idsToTry.push("sidebar-no-repos", "sidebar-no-skills");

  for (const id of idsToTry) {
    try {
      box.remove(id);
    } catch {
      // Element doesn't exist, ignore
    }
  }
}

/**
 * Update the sidebar to reflect current config state
 */
export function updateSidebar(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  config: PartialConfig
): void {
  const { reposContainer, skillsContainer, goalText, statusText } = elements;

  // Clear and rebuild repos
  clearBox(reposContainer, renderer);
  if (config.repos.length > 0) {
    for (const [i, repo] of config.repos.entries()) {
      const repoText = new TextRenderable(renderer, {
        content: `\u2022 ${repo}`,
        fg: "#94a3b8",
        id: `sidebar-repo-${i}`,
      });
      reposContainer.add(repoText);
    }
  } else {
    const noRepos = new TextRenderable(renderer, {
      content: "(none)",
      fg: "#64748b",
      id: "sidebar-no-repos",
    });
    reposContainer.add(noRepos);
  }

  // Clear and rebuild skills
  clearBox(skillsContainer, renderer);
  if (config.skills.length > 0) {
    for (const [i, skill] of config.skills.entries()) {
      const skillText = new TextRenderable(renderer, {
        content: `\u2022 ${skill}`,
        fg: "#94a3b8",
        id: `sidebar-skill-${i}`,
      });
      skillsContainer.add(skillText);
    }
  } else {
    const noSkills = new TextRenderable(renderer, {
      content: "(none)",
      fg: "#64748b",
      id: "sidebar-no-skills",
    });
    skillsContainer.add(noSkills);
  }

  // Update goal
  if (config.goal) {
    goalText.content = config.goal;
    goalText.fg = "#94a3b8";
  } else {
    goalText.content = "(not set)";
    goalText.fg = "#64748b";
  }

  // Update status
  if (config.repos.length > 0) {
    statusText.content = '\u2713 Ready to proceed\nSay "ready" to continue';
    statusText.fg = "#22c55e";
  } else {
    statusText.content = 'Status: Waiting for input...\nSay "ready" when done';
    statusText.fg = "#64748b";
  }
}

/**
 * Add a message to the chat scroll box
 */
export function addMessageToChat(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  message: ChatMessage,
  index: number
): void {
  const prefix = message.role === "user" ? "\u{1F464}" : "\u{1F916}";
  const fg = message.role === "user" ? "#e2e8f0" : "#94a3b8";

  const messageText = new TextRenderable(renderer, {
    content: `${prefix} ${message.content}`,
    fg,
    id: `msg-${index}`,
    marginBottom: 1,
    maxWidth: 56,
  });
  elements.chatScrollBox.add(messageText);
}

/**
 * Show streaming response in chat
 */
export function createStreamingMessage(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements
): { update: (chunk: string) => void; finish: () => void } {
  let streamingText = "";

  const streamingPrefix = new TextRenderable(renderer, {
    content: "\u{1F916} ",
    fg: "#94a3b8",
    id: "streaming-prefix",
    marginBottom: 0,
    marginTop: 1,
  });
  elements.chatScrollBox.add(streamingPrefix);

  const streamingMessage = new TextRenderable(renderer, {
    content: "",
    fg: "#94a3b8",
    id: "streaming-content",
    marginBottom: 1,
    maxWidth: 56,
  });
  elements.chatScrollBox.add(streamingMessage);

  const update = (chunk: string) => {
    streamingText += chunk;
    streamingMessage.content = streamingText;
  };

  const finish = () => {
    // Remove streaming elements
    try {
      elements.chatScrollBox.remove("streaming-prefix");
      elements.chatScrollBox.remove("streaming-content");
    } catch {
      // Elements may not exist
    }
  };

  return { finish, update };
}

/**
 * Wait for user input in the chat
 */
export function waitForChatInput(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  messages: ChatMessage[]
): Promise<ChatInputResult> {
  return new Promise((resolve) => {
    const { input, chatScrollBox, container } = elements;

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      input.blur();
      hideFooter(renderer);
    };

    const handleKeypress = (key: KeyEvent) => {
      if (isEscape(key)) {
        cleanup();
        resolve({ cancelled: true, message: "" });
        return;
      }

      if (isEnter(key)) {
        const message = input.value.trim();
        // Note: We don't need to clear input since layout is recreated after each message
        cleanup();
        resolve({ cancelled: false, message });
        return;
      }

      // Handle copy when not focused in input (copy last assistant message)
      if (!input.focused && isCtrlC(key)) {
        const lastAssistantMessage = messages.findLast(
          (m) => m.role === "assistant"
        );
        if (lastAssistantMessage) {
          copyToClipboard(lastAssistantMessage.content).catch(() => {
            /* ignore clipboard errors */
          });
        }
        return;
      }

      // Handle scrolling when not focused in input
      if (!input.focused) {
        if (isKey(key, "pageup")) {
          chatScrollBox.scrollBy(-12, "step");
        } else if (isKey(key, "pagedown")) {
          chatScrollBox.scrollBy(12, "step");
        }
      }
    };

    input.focus();
    showFooter(renderer, container, {
      back: true,
      custom: ["Enter Send", '"ready" to proceed', "Ctrl+C Copy", "Esc Cancel"],
      navigate: false,
      select: false,
    });
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
