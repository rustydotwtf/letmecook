import {
  createCliRenderer,
  type CliRenderer,
  BoxRenderable,
  TextRenderable,
  ASCIIFontRenderable,
  RGBA,
} from "@opentui/core";
import { measureText } from "@opentui/core";

let renderer: CliRenderer | null = null;

export async function createRenderer(): Promise<CliRenderer> {
  if (renderer) {
    return renderer;
  }

  renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
  });

  renderer.setBackgroundColor("#0f172a");

  return renderer;
}

export function getRenderer(): CliRenderer | null {
  return renderer;
}

export function destroyRenderer(): void {
  if (renderer) {
    renderer.destroy();
    renderer = null;
  }
}

export interface LayoutElements {
  container: BoxRenderable;
  title: ASCIIFontRenderable;
  content: BoxRenderable;
}

export function createBaseLayout(r: CliRenderer, subtitle?: string): LayoutElements {
  const width = r.terminalWidth;

  // Main container
  const container = new BoxRenderable(r, {
    id: "main-container",
    width: "100%",
    height: "100%",
    flexDirection: "column",
    alignItems: "center",
    padding: 1,
  });
  r.root.add(container);

  // Title
  const titleText = "letmecook";
  const titleFont = "tiny";
  const { width: titleWidth } = measureText({ text: titleText, font: titleFont });
  const centerX = Math.floor(width / 2) - Math.floor(titleWidth / 2);

  const title = new ASCIIFontRenderable(r, {
    id: "title",
    text: titleText,
    font: titleFont,
    color: RGBA.fromHex("#f8fafc"),
    position: "absolute",
    left: centerX,
    top: 11,
  });
  r.root.add(title);

  // Content box below title
  const content = new BoxRenderable(r, {
    id: "content",
    width: Math.min(70, width - 4),
    marginTop: 15,
    padding: 1,
    flexDirection: "column",
    borderStyle: "single",
    borderColor: "#475569",
    backgroundColor: "#1e293b",
  });
  container.add(content);

  // Add subtitle if provided
  if (subtitle) {
    const subtitleText = new TextRenderable(r, {
      id: "subtitle",
      content: subtitle,
      fg: "#94a3b8",
      marginBottom: 1,
    });
    content.add(subtitleText);
  }

  return { container, title, content };
}

export function clearLayout(r: CliRenderer): void {
  // Remove known elements (ignore if they don't exist)
  const elements = ["main-container", "title", "content"];
  for (const id of elements) {
    try {
      r.root.remove(id);
    } catch {
      // Element doesn't exist
    }
  }
}
