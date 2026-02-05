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

function addChatMessages(
  renderer: CliRenderer,
  chatScrollBox: ScrollBoxRenderable,
  messages: ChatMessage[],
  chatWidth: number
) {
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
}

function createChatInput(
  renderer: CliRenderer,
  width: number
): { input: InputRenderable; inputContainer: BoxRenderable } {
  const inputContainer = new BoxRenderable(renderer, {
    flexDirection: "column",
    id: "input-container",
    marginTop: 1,
    width,
  });

  const input = new InputRenderable(renderer, {
    backgroundColor: "#334155",
    cursorColor: "#38bdf8",
    height: 1,
    id: "chat-input",
    placeholder: "Type your message...",
    placeholderColor: "#64748b",
    textColor: "#f8fafc",
    width: width - 2,
  });
  inputContainer.add(input);

  return { input, inputContainer };
}

function createChatBox(
  renderer: CliRenderer,
  width: number,
  height: number,
  messages: ChatMessage[]
): {
  chatBox: BoxRenderable;
  chatScrollBox: ScrollBoxRenderable;
  inputContainer: BoxRenderable;
  input: InputRenderable;
} {
  const chatBox = new BoxRenderable(renderer, {
    backgroundColor: "#1e293b",
    borderColor: "#475569",
    borderStyle: "single",
    flexDirection: "column",
    height: Math.max(16, height - 22),
    id: "chat-box",
    padding: 1,
    width,
  });

  const chatHeader = new TextRenderable(renderer, {
    content: "Chat",
    fg: "#94a3b8",
    id: "chat-header",
    marginBottom: 1,
  });
  chatBox.add(chatHeader);

  const chatScrollBox = new ScrollBoxRenderable(renderer, {
    backgroundColor: "transparent",
    border: false,
    height: Math.max(8, height - 32),
    id: "chat-scrollbox",
    scrollX: false,
    scrollY: true,
    stickyScroll: true,
    stickyStart: "bottom",
    width: width - 4,
  });
  chatBox.add(chatScrollBox);

  addChatMessages(renderer, chatScrollBox, messages, width);

  const { input, inputContainer } = createChatInput(renderer, width - 4);
  chatBox.add(inputContainer);

  input.onPaste = (event) => {
    const text = event.text.replaceAll(/[\r\n]+/g, "");
    if (!text) {
      return;
    }
    input.insertText(text);
    event.preventDefault();
  };

  return { chatBox, chatScrollBox, input, inputContainer };
}

function addSidebarElements(
  renderer: CliRenderer,
  sidebarBox: BoxRenderable,
  width: number
): {
  goalText: TextRenderable;
  reposContainer: BoxRenderable;
  skillsContainer: BoxRenderable;
  statusText: TextRenderable;
} {
  const reposContainer = new BoxRenderable(renderer, {
    flexDirection: "column",
    id: "repos-container",
    marginBottom: 1,
    marginLeft: 1,
  });
  sidebarBox.add(reposContainer);

  const skillsContainer = new BoxRenderable(renderer, {
    flexDirection: "column",
    id: "skills-container",
    marginBottom: 1,
    marginLeft: 1,
  });
  sidebarBox.add(skillsContainer);

  const goalText = new TextRenderable(renderer, {
    content: "(not set)",
    fg: "#64748b",
    id: "goal-text",
    marginBottom: 1,
    marginLeft: 1,
    maxWidth: width - 4,
  });
  sidebarBox.add(goalText);

  const statusText = new TextRenderable(renderer, {
    content: 'Status: Waiting for input...\nSay "ready" when done',
    fg: "#64748b",
    id: "status-text",
    marginTop: 2,
  });
  sidebarBox.add(statusText);

  return { goalText, reposContainer, skillsContainer, statusText };
}

function createSidebarBox(
  renderer: CliRenderer,
  width: number,
  height: number
): {
  goalText: TextRenderable;
  reposContainer: BoxRenderable;
  sidebarBox: BoxRenderable;
  skillsContainer: BoxRenderable;
  statusText: TextRenderable;
} {
  const sidebarBox = new BoxRenderable(renderer, {
    backgroundColor: "#1e293b",
    borderColor: "#475569",
    borderStyle: "single",
    flexDirection: "column",
    height: Math.max(16, height - 22),
    id: "sidebar-box",
    padding: 1,
    width,
  });

  sidebarBox.add(
    new TextRenderable(renderer, {
      content: "Configuration",
      fg: "#94a3b8",
      id: "sidebar-header",
      marginBottom: 1,
    })
  );

  sidebarBox.add(
    new TextRenderable(renderer, {
      content: "\u{1F4E6} Repositories:",
      fg: "#38bdf8",
      id: "repos-label",
      marginBottom: 0,
    })
  );

  sidebarBox.add(
    new TextRenderable(renderer, {
      content: "\u{1F6E0}\uFE0F  Skills:",
      fg: "#38bdf8",
      id: "skills-label",
      marginBottom: 0,
      marginTop: 1,
    })
  );

  sidebarBox.add(
    new TextRenderable(renderer, {
      content: "\u{1F3AF} Goal:",
      fg: "#38bdf8",
      id: "goal-label",
      marginBottom: 0,
      marginTop: 1,
    })
  );

  const { reposContainer, skillsContainer, goalText, statusText } =
    addSidebarElements(renderer, sidebarBox, width);

  return { goalText, reposContainer, sidebarBox, skillsContainer, statusText };
}

function createTitle(
  renderer: CliRenderer,
  width: number
): ASCIIFontRenderable {
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
  return title;
}

function createMainLayout(
  renderer: CliRenderer,
  width: number,
  height: number,
  messages: ChatMessage[]
): {
  chatBox: BoxRenderable;
  chatScrollBox: ScrollBoxRenderable;
  container: BoxRenderable;
  goalText: TextRenderable;
  input: InputRenderable;
  inputContainer: BoxRenderable;
  mainBox: BoxRenderable;
  reposContainer: BoxRenderable;
  sidebarBox: BoxRenderable;
  skillsContainer: BoxRenderable;
  statusText: TextRenderable;
  title: ASCIIFontRenderable;
} {
  clearLayout(renderer);

  const container = new BoxRenderable(renderer, {
    alignItems: "center",
    flexDirection: "column",
    height: "100%",
    id: "main-container",
    padding: 1,
    width: "100%",
  });
  renderer.root.add(container);

  const title = createTitle(renderer, width);

  const { mainBox, chatWidth, sidebarWidth } = createMainBoxLayout(
    renderer,
    container,
    width
  );

  const { chatBox, chatScrollBox, input, inputContainer } = createChatBox(
    renderer,
    chatWidth,
    height,
    messages
  );
  mainBox.add(chatBox);

  const { sidebarBox, goalText, reposContainer, skillsContainer, statusText } =
    createSidebarBox(renderer, sidebarWidth, height);
  mainBox.add(sidebarBox);

  return {
    chatBox,
    chatScrollBox,
    container,
    goalText,
    input,
    inputContainer,
    mainBox,
    reposContainer,
    sidebarBox,
    skillsContainer,
    statusText,
    title,
  };
}

function createMainBoxLayout(
  renderer: CliRenderer,
  container: BoxRenderable,
  width: number
): { chatWidth: number; mainBox: BoxRenderable; sidebarWidth: number } {
  const totalWidth = Math.min(100, width - 4);
  const chatWidth = Math.floor(totalWidth * 0.62);
  const sidebarWidth = totalWidth - chatWidth - 1;

  const mainBox = new BoxRenderable(renderer, {
    flexDirection: "row",
    gap: 1,
    id: "content",
    marginTop: 15,
    width: totalWidth,
  });
  container.add(mainBox);

  return { chatWidth, mainBox, sidebarWidth };
}

function createElements(
  renderer: CliRenderer,
  config: PartialConfig,
  layout: {
    chatBox: BoxRenderable;
    chatScrollBox: ScrollBoxRenderable;
    container: BoxRenderable;
    goalText: TextRenderable;
    input: InputRenderable;
    inputContainer: BoxRenderable;
    mainBox: BoxRenderable;
    reposContainer: BoxRenderable;
    sidebarBox: BoxRenderable;
    skillsContainer: BoxRenderable;
    statusText: TextRenderable;
    title: ASCIIFontRenderable;
  }
): ChatWithSidebarElements {
  const cookingIndicator = createCookingIndicator(
    renderer,
    layout.inputContainer
  );

  const cookingState = {
    cookingIndicator,
    input: layout.input,
  };

  const elements: ChatWithSidebarElements = {
    chatBox: layout.chatBox,
    chatScrollBox: layout.chatScrollBox,
    container: layout.container,
    cookingIndicator,
    goalText: layout.goalText,
    hideCooking: () => {
      if (cookingState.cookingIndicator) {
        cookingState.cookingIndicator.stop();
      }
    },
    input: layout.input,
    inputContainer: layout.inputContainer,
    mainBox: layout.mainBox,
    reposContainer: layout.reposContainer,
    showCooking: () => {
      cookingState.input.blur();
      if (cookingState.cookingIndicator) {
        cookingState.cookingIndicator.start();
      }
    },
    sidebarBox: layout.sidebarBox,
    skillsContainer: layout.skillsContainer,
    statusText: layout.statusText,
    title: layout.title,
  };

  updateSidebar(renderer, elements, config);

  return elements;
}

/**
 * Create a two-column layout with chat on the left and config sidebar on the right
 */
export function createChatWithSidebarLayout(
  renderer: CliRenderer,
  messages: ChatMessage[],
  config: PartialConfig
): ChatWithSidebarElements {
  const width = renderer.terminalWidth;
  const height = renderer.terminalHeight;

  const layout = createMainLayout(renderer, width, height, messages);

  return createElements(renderer, config, layout);
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

function updateSidebarRepos(
  renderer: CliRenderer,
  reposContainer: BoxRenderable,
  repos: string[]
) {
  clearBox(reposContainer, renderer);
  if (repos.length > 0) {
    for (const [i, repo] of repos.entries()) {
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
}

function updateSidebarSkills(
  renderer: CliRenderer,
  skillsContainer: BoxRenderable,
  skills: string[]
) {
  clearBox(skillsContainer, renderer);
  if (skills.length > 0) {
    for (const [i, skill] of skills.entries()) {
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
}

function updateSidebarGoal(
  goalText: TextRenderable,
  goal: string | null | undefined
) {
  if (goal) {
    goalText.content = goal;
    goalText.fg = "#94a3b8";
  } else {
    goalText.content = "(not set)";
    goalText.fg = "#64748b";
  }
}

function updateSidebarStatus(statusText: TextRenderable, reposLength: number) {
  if (reposLength > 0) {
    statusText.content = '\u2713 Ready to proceed\nSay "ready" to continue';
    statusText.fg = "#22c55e";
  } else {
    statusText.content = 'Status: Waiting for input...\nSay "ready" when done';
    statusText.fg = "#64748b";
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

  updateSidebarRepos(renderer, reposContainer, config.repos);
  updateSidebarSkills(renderer, skillsContainer, config.skills);
  updateSidebarGoal(goalText, config.goal);
  updateSidebarStatus(statusText, config.repos.length);
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

function handleChatEscapeKeypress(
  resolve: (result: ChatInputResult) => void,
  cleanup: () => void
) {
  cleanup();
  resolve({ cancelled: true, message: "" });
}

function handleChatEnterKeypress(
  input: InputRenderable,
  resolve: (result: ChatInputResult) => void,
  cleanup: () => void
) {
  const message = input.value.trim();
  cleanup();
  resolve({ cancelled: false, message });
}

function handleChatCopyKeypress(
  input: InputRenderable,
  messages: ChatMessage[]
) {
  if (!input.focused) {
    const lastAssistantMessage = messages.findLast(
      (m) => m.role === "assistant"
    );
    if (lastAssistantMessage) {
      copyToClipboard(lastAssistantMessage.content);
    }
  }
}

function handleChatScrollKeypress(
  key: KeyEvent,
  input: InputRenderable,
  chatScrollBox: ScrollBoxRenderable
) {
  if (!input.focused) {
    if (isKey(key, "pageup")) {
      chatScrollBox.scrollBy(-12, "step");
    } else if (isKey(key, "pagedown")) {
      chatScrollBox.scrollBy(12, "step");
    }
  }
}

function handleChatKeypress(
  key: KeyEvent,
  input: InputRenderable,
  chatScrollBox: ScrollBoxRenderable,
  messages: ChatMessage[],
  resolve: (result: ChatInputResult) => void,
  cleanup: () => void
) {
  if (isEscape(key)) {
    handleChatEscapeKeypress(resolve, cleanup);
    return;
  }

  if (isEnter(key)) {
    handleChatEnterKeypress(input, resolve, cleanup);
    return;
  }

  if (isCtrlC(key)) {
    handleChatCopyKeypress(input, messages);
    return;
  }

  handleChatScrollKeypress(key, input, chatScrollBox);
}

function createChatInputPromise(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  messages: ChatMessage[]
): Promise<ChatInputResult> {
  // eslint-disable-next-line promise/avoid-new -- Necessary for callback-based event API
  return new Promise((resolve) => {
    const { input, chatScrollBox, container } = elements;

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      input.blur();
      hideFooter(renderer);
    };

    const handleKeypress = (key: KeyEvent) => {
      handleChatKeypress(key, input, chatScrollBox, messages, resolve, cleanup);
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

/**
 * Wait for user input in the chat
 */
export function waitForChatInput(
  renderer: CliRenderer,
  elements: ChatWithSidebarElements,
  messages: ChatMessage[]
): Promise<ChatInputResult> {
  return createChatInputPromise(renderer, elements, messages);
}
