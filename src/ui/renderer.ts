import {
  ASCIIFontRenderable,
  BoxRenderable,
  type CliRenderer,
  createCliRenderer,
  measureText,
  RGBA,
  TextRenderable,
} from "@opentui/core";

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

function createTitle(r: CliRenderer, width: number): ASCIIFontRenderable {
  const titleText = "letmecook";
  const titleFont = "tiny";
  const { width: titleWidth } = measureText({
    font: titleFont,
    text: titleText,
  });
  const centerX = Math.floor(width / 2) - Math.floor(titleWidth / 2);

  const title = new ASCIIFontRenderable(r, {
    color: RGBA.fromHex("#f8fafc"),
    font: titleFont,
    id: "title",
    left: centerX,
    position: "absolute",
    text: titleText,
    top: 11,
  });
  r.root.add(title);
  return title;
}

function createContent(r: CliRenderer, width: number): BoxRenderable {
  return new BoxRenderable(r, {
    backgroundColor: "#1e293b",
    borderColor: "#475569",
    borderStyle: "single",
    flexDirection: "column",
    id: "content",
    marginTop: 15,
    padding: 1,
    width: Math.min(70, width - 4),
  });
}

function createMainContainer(r: CliRenderer): BoxRenderable {
  const container = new BoxRenderable(r, {
    alignItems: "center",
    flexDirection: "column",
    height: "100%",
    id: "main-container",
    padding: 1,
    width: "100%",
  });
  r.root.add(container);
  return container;
}

function addSubtitle(
  r: CliRenderer,
  content: BoxRenderable,
  subtitle: string
): void {
  content.add(
    new TextRenderable(r, {
      content: subtitle,
      fg: "#94a3b8",
      id: "subtitle",
      marginBottom: 1,
    })
  );
}

export function createBaseLayout(
  r: CliRenderer,
  subtitle?: string
): LayoutElements {
  const width = r.terminalWidth;
  const container = createMainContainer(r);
  const title = createTitle(r, width);
  const content = createContent(r, width);
  container.add(content);

  if (subtitle) {
    addSubtitle(r, content, subtitle);
  }

  return { container, content, title };
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
