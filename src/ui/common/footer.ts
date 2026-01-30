import {
  type CliRenderer,
  TextRenderable,
  type Renderable,
} from "@opentui/core";

export interface FooterActions {
  navigate?: boolean; // Show ↑↓ Navigate
  select?: boolean; // Show Enter Select
  back?: boolean; // Show Esc Back
  new?: boolean; // Show n New
  delete?: boolean; // Show d Delete
  quit?: boolean; // Show q Quit
  custom?: string[]; // Custom action hints like ["Tab Switch", "s Save"]
}

let footerSeparator: TextRenderable | null = null;
let footerText: TextRenderable | null = null;
let footerParent: Renderable | null = null;

function addActionHint(
  parts: string[],
  condition: boolean,
  hint: string
): void {
  if (condition) {
    parts.push(hint);
  }
}

function buildFooterParts(actions: FooterActions): string[] {
  const {
    navigate = true,
    select = true,
    back = true,
    new: showNew = false,
    delete: showDelete = false,
    quit = false,
    custom = [],
  } = actions;

  const parts: string[] = [];

  addActionHint(parts, navigate, "↑↓ Navigate");
  addActionHint(parts, select, "Enter Select");
  addActionHint(parts, back, "Esc Back");
  addActionHint(parts, showNew, "n New");
  addActionHint(parts, showDelete, "d Delete");
  addActionHint(parts, quit, "q Quit");
  parts.push(...custom);

  return parts;
}

function createFooterRenderables(
  renderer: CliRenderer,
  parent: Renderable,
  footerContent: string
): void {
  const separator = new TextRenderable(renderer, {
    content: "─".repeat(66),
    fg: "#475569",
    id: "footer-separator",
    marginTop: 1,
  });
  parent.add(separator);

  footerText = new TextRenderable(renderer, {
    content: footerContent,
    fg: "#64748b",
    id: "footer-text",
  });
  parent.add(footerText);

  footerSeparator = separator;
  footerParent = parent;
}

export function showFooter(
  renderer: CliRenderer,
  parent: Renderable,
  actions: FooterActions = {}
): void {
  const parts = buildFooterParts(actions);
  const footerContent = parts.join("  ");

  hideFooter(renderer);
  createFooterRenderables(renderer, parent, footerContent);
}

export function updateFooter(
  renderer: CliRenderer,
  parent: Renderable,
  actions: FooterActions
): void {
  hideFooter(renderer);
  showFooter(renderer, parent, actions);
}

export function hideFooter(_renderer: CliRenderer): void {
  if (footerSeparator) {
    if (footerParent) {
      footerParent.remove("footer-separator");
    }
    footerSeparator = null;
  }
  if (footerText) {
    if (footerParent) {
      footerParent.remove("footer-text");
    }
    footerText = null;
  }
  footerParent = null;
}
