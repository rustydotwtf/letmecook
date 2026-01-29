import {
  type CliRenderer,
  TextRenderable,
  InputRenderable,
  type KeyEvent,
  ScrollBoxRenderable,
  BoxRenderable,
  ASCIIFontRenderable,
  RGBA,
} from "@opentui/core";
import { measureText } from "@opentui/core";

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
    id: "main-container",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    padding: 1,
  });
  renderer.root.add(container);

  // Title
  const titleText = "letmecook";
  const titleFont = "tiny";
  const { width: titleWidth } = measureText({
    text: titleText,
    font: titleFont,
  });
  const centerX = Math.floor(width / 2) - Math.floor(titleWidth / 2);

  const title = new ASCIIFontRenderable(renderer, {
    id: "title",
    text: titleText,
    font: titleFont,
    color: RGBA.fromHex("#f8fafc"),
    position: "absolute",
    left: centerX,
    top: 11,
  });
  renderer.root.add(title);

  // Calculate widths
  const totalWidth = Math.min(100, width - 4);
  const chatWidth = Math.floor(totalWidth * 0.62);
  const sidebarWidth = totalWidth - chatWidth - 1; // -1 for gap

  // Main horizontal box containing chat and sidebar
  const mainBox = new BoxRenderable(renderer, {
    id: "content",
    width: totalWidth,
    marginTop: 15,
    flexDirection: "row",
    gap: 1,
  });
  container.add(mainBox);

  // === LEFT: Chat Box ===
  const chatBox = new BoxRenderable(renderer, {
    id: "chat-box",
    width: chatWidth,
    height: Math.max(16, height - 22),
    flexDirection: "column",
    borderStyle: "single",
    borderColor: "#475569",
    backgroundColor: "#1e293b",
    padding: 1,
  });
  mainBox.add(chatBox);

  // Chat header
  const chatHeader = new TextRenderable(renderer, {
    id: "chat-header",
    content: "Chat",
    fg: "#94a3b8",
    marginBottom: 1,
  });
  chatBox.add(chatHeader);

  // Chat scrollable area
  const chatScrollBox = new ScrollBoxRenderable(renderer, {
    id: "chat-scrollbox",
    width: chatWidth - 4,
    height: Math.max(8, height - 32),
    scrollY: true,
    scrollX: false,
    stickyScroll: true,
    stickyStart: "bottom",
    border: false,
    backgroundColor: "transparent",
  });
  chatBox.add(chatScrollBox);

  // Add existing messages
  messages.forEach((msg, index) => {
    const prefix = msg.role === "user" ? "\u{1F464}" : "\u{1F916}";
    const fg = msg.role === "user" ? "#e2e8f0" : "#94a3b8";

    const messageText = new TextRenderable(renderer, {
      id: `msg-${index}`,
      content: `${prefix} ${msg.content}`,
      fg,
      marginBottom: 1,
      maxWidth: chatWidth - 8,
    });
    chatScrollBox.add(messageText);
  });

  // Input container
  const inputContainer = new BoxRenderable(renderer, {
    id: "input-container",
    width: chatWidth - 4,
    flexDirection: "column",
    marginTop: 1,
  });
  chatBox.add(inputContainer);

  // Input
  const input = new InputRenderable(renderer, {
    id: "chat-input",
    width: chatWidth - 6,
    height: 1,
    placeholder: "Type your message...",
    placeholderColor: "#64748b",
    backgroundColor: "#334155",
    textColor: "#f8fafc",
    cursorColor: "#38bdf8",
  });
  inputContainer.add(input);

  // Enable pasting
  input.onPaste = (event) => {
    const text = event.text.replace(/[\r\n]+/g, "");
    if (!text) return;
    input.insertText(text);
    event.preventDefault();
  };

  // === RIGHT: Sidebar Box ===
  const sidebarBox = new BoxRenderable(renderer, {
    id: "sidebar-box",
    width: sidebarWidth,
    height: Math.max(16, height - 22),
    flexDirection: "column",
    borderStyle: "single",
    borderColor: "#475569",
    backgroundColor: "#1e293b",
    padding: 1,
  });
  mainBox.add(sidebarBox);

  // Sidebar header
  const sidebarHeader = new TextRenderable(renderer, {
    id: "sidebar-header",
    content: "Configuration",
    fg: "#94a3b8",
    marginBottom: 1,
  });
  sidebarBox.add(sidebarHeader);

  // Repositories section
  const reposLabel = new TextRenderable(renderer, {
    id: "repos-label",
    content: "\u{1F4E6} Repositories:",
    fg: "#38bdf8",
    marginBottom: 0,
  });
  sidebarBox.add(reposLabel);

  const reposContainer = new BoxRenderable(renderer, {
    id: "repos-container",
    flexDirection: "column",
    marginBottom: 1,
    marginLeft: 1,
  });
  sidebarBox.add(reposContainer);

  // Skills section
  const skillsLabel = new TextRenderable(renderer, {
    id: "skills-label",
    content: "\u{1F6E0}\uFE0F  Skills:",
    fg: "#38bdf8",
    marginTop: 1,
    marginBottom: 0,
  });
  sidebarBox.add(skillsLabel);

  const skillsContainer = new BoxRenderable(renderer, {
    id: "skills-container",
    flexDirection: "column",
    marginBottom: 1,
    marginLeft: 1,
  });
  sidebarBox.add(skillsContainer);

  // Goal section
  const goalLabel = new TextRenderable(renderer, {
    id: "goal-label",
    content: "\u{1F3AF} Goal:",
    fg: "#38bdf8",
    marginTop: 1,
    marginBottom: 0,
  });
  sidebarBox.add(goalLabel);

  const goalText = new TextRenderable(renderer, {
    id: "goal-text",
    content: "(not set)",
    fg: "#64748b",
    marginLeft: 1,
    marginBottom: 1,
    maxWidth: sidebarWidth - 4,
  });
  sidebarBox.add(goalText);

  // Status
  const statusText = new TextRenderable(renderer, {
    id: "status-text",
    content: 'Status: Waiting for input...\nSay "ready" when done',
    fg: "#64748b",
    marginTop: 2,
  });
  sidebarBox.add(statusText);

  // Create cooking indicator (but don't start it yet)
  const cookingIndicator = createCookingIndicator(renderer, inputContainer);

  // Populate initial config
  const elements: ChatWithSidebarElements = {
    container,
    title,
    mainBox,
    chatBox,
    chatScrollBox,
    sidebarBox,
    inputContainer,
    input,
    reposContainer,
    skillsContainer,
    goalText,
    statusText,
    cookingIndicator,
    showCooking: () => {
      // Disable input and show cooking indicator
      input.blur();
      if (cookingIndicator) {
        cookingIndicator.start();
      }
    },
    hideCooking: () => {
      // Hide cooking indicator and re-enable input
      if (cookingIndicator) {
        cookingIndicator.stop();
      }
    },
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
  for (let i = 0; i < 50; i++) {
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
    config.repos.forEach((repo, i) => {
      const repoText = new TextRenderable(renderer, {
        id: `sidebar-repo-${i}`,
        content: `\u2022 ${repo}`,
        fg: "#94a3b8",
      });
      reposContainer.add(repoText);
    });
  } else {
    const noRepos = new TextRenderable(renderer, {
      id: "sidebar-no-repos",
      content: "(none)",
      fg: "#64748b",
    });
    reposContainer.add(noRepos);
  }

  // Clear and rebuild skills
  clearBox(skillsContainer, renderer);
  if (config.skills.length > 0) {
    config.skills.forEach((skill, i) => {
      const skillText = new TextRenderable(renderer, {
        id: `sidebar-skill-${i}`,
        content: `\u2022 ${skill}`,
        fg: "#94a3b8",
      });
      skillsContainer.add(skillText);
    });
  } else {
    const noSkills = new TextRenderable(renderer, {
      id: "sidebar-no-skills",
      content: "(none)",
      fg: "#64748b",
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
    id: `msg-${index}`,
    content: `${prefix} ${message.content}`,
    fg,
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
    id: "streaming-prefix",
    content: "\u{1F916} ",
    fg: "#94a3b8",
    marginTop: 1,
    marginBottom: 0,
  });
  elements.chatScrollBox.add(streamingPrefix);

  const streamingMessage = new TextRenderable(renderer, {
    id: "streaming-content",
    content: "",
    fg: "#94a3b8",
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

  return { update, finish };
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
        resolve({ message: "", cancelled: true });
        return;
      }

      if (isEnter(key)) {
        const message = input.value.trim();
        // Note: We don't need to clear input since layout is recreated after each message
        cleanup();
        resolve({ message, cancelled: false });
        return;
      }

      // Handle copy when not focused in input (copy last assistant message)
      if (!input.focused && isCtrlC(key)) {
        const lastAssistantMessage = messages.findLast(
          (m) => m.role === "assistant"
        );
        if (lastAssistantMessage) {
          void copyToClipboard(lastAssistantMessage.content);
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
      navigate: false,
      select: false,
      back: true,
      custom: ["Enter Send", '"ready" to proceed', "Ctrl+C Copy", "Esc Cancel"],
    });
    renderer.keyInput.on("keypress", handleKeypress);
  });
}
