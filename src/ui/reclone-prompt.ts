import {
  type CliRenderer,
  TextRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  type KeyEvent,
} from "@opentui/core";

import type { RepoSpec } from "../types";

import { showFooter, hideFooter } from "./common/footer";
import { isEscape } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export type RecloneChoice = "reclone" | "skip";

interface SetupResult {
  content: ReturnType<typeof createBaseLayout>["content"];
  select: SelectRenderable;
}

function createHeader(renderer: CliRenderer, repo: RepoSpec) {
  return new TextRenderable(renderer, {
    content: `${repo.owner}/${repo.name}`,
    fg: "#38bdf8",
    id: "repo-info",
    marginBottom: 1,
  });
}

function createWarning(renderer: CliRenderer) {
  return new TextRenderable(renderer, {
    content: "We had issues updating this repo.",
    fg: "#f59e0b",
    id: "warning",
    marginBottom: 0,
  });
}

function createQuestion(renderer: CliRenderer) {
  return new TextRenderable(renderer, {
    content: "Wipe and reclone it?",
    fg: "#e2e8f0",
    id: "question",
    marginBottom: 1,
  });
}

function createSelect(renderer: CliRenderer) {
  const select = new SelectRenderable(renderer, {
    backgroundColor: "transparent",
    focusedBackgroundColor: "transparent",
    height: 2,
    id: "reclone-select",
    marginTop: 1,
    options: [
      { description: "", name: "Reclone", value: "reclone" },
      { description: "", name: "Skip", value: "skip" },
    ],
    selectedBackgroundColor: "#334155",
    selectedTextColor: "#38bdf8",
    showDescription: false,
    textColor: "#e2e8f0",
    width: 24,
  });
  select.focus();
  return select;
}

function setupUI(renderer: CliRenderer, repo: RepoSpec): SetupResult {
  clearLayout(renderer);
  const { content } = createBaseLayout(renderer, "Update issue");
  content.add(createHeader(renderer, repo));
  content.add(createWarning(renderer));
  content.add(createQuestion(renderer));
  const select = createSelect(renderer);
  content.add(select);
  return { content, select };
}

export function showReclonePrompt(
  renderer: CliRenderer,
  repo: RepoSpec
): Promise<RecloneChoice> {
  const { content, select } = setupUI(renderer, repo);

  const cleanup = () => {
    select.off(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
    renderer.keyInput.off("keypress", handleKeypress);
    select.blur();
    hideFooter(renderer);
    clearLayout(renderer);
  };

  const handleSelect = (_index: number, option: { value: string }) => {
    cleanup();
    resolve(option.value as RecloneChoice);
  };

  const handleKeypress = (key: KeyEvent) => {
    if (isEscape(key)) {
      cleanup();
      resolve("skip");
    }
  };

  let resolve: (value: RecloneChoice) => void;
  // eslint-disable-next-line github/no-then, promise/avoid-new
  const promise = new Promise<RecloneChoice>((_resolve) => {
    resolve = _resolve;
  });

  showFooter(renderer, content, {
    back: true,
    custom: ["Esc Skip"],
    navigate: true,
    select: true,
  });

  select.on(SelectRenderableEvents.ITEM_SELECTED, handleSelect);
  renderer.keyInput.on("keypress", handleKeypress);

  return promise;
}
