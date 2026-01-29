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

export function showFooter(
  renderer: CliRenderer,
  parent: Renderable,
  actions: FooterActions = {}
): void {
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

  if (navigate) {
    parts.push("↑↓ Navigate");
  }
  if (select) {
    parts.push("Enter Select");
  }
  if (back) {
    parts.push("Esc Back");
  }
  if (showNew) {
    parts.push("n New");
  }
  if (showDelete) {
    parts.push("d Delete");
  }
  if (quit) {
    parts.push("q Quit");
  }
  if (custom.length > 0) {
    parts.push(...custom);
  }

  const footerContent = parts.join("  ");

  // Hide any existing footer first
  hideFooter(renderer);

  // Create separator line
  const separator = new TextRenderable(renderer, {
    id: "footer-separator",
    content: "─".repeat(66), // Approximate width for separator line
    fg: "#475569",
    marginTop: 1,
  });
  parent.add(separator);

  // Create footer text
  footerText = new TextRenderable(renderer, {
    id: "footer-text",
    content: footerContent,
    fg: "#64748b",
  });
  parent.add(footerText);

  footerSeparator = separator;
  footerParent = parent;
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
