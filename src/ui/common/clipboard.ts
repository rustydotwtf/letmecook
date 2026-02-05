import { $ } from "bun";
import { platform } from "node:os";

/**
 * Writes text to clipboard via OSC 52 escape sequence.
 * This allows clipboard operations to work over SSH by having
 * the terminal emulator handle the clipboard locally.
 */
function writeOsc52(text: string): void {
  if (!process.stdout.isTTY) {
    return;
  }
  const base64 = Buffer.from(text).toString("base64");
  const osc52 = `\u001B]52;c;${base64}\u0007`;
  // tmux and screen require DCS passthrough wrapping
  const passthrough = process.env["TMUX"] || process.env["STY"];
  const sequence = passthrough ? `\u001BPtmux;\u001B${osc52}\u001B\\` : osc52;
  process.stdout.write(sequence);
}

async function spawnClipboardWriter(
  args: string[],
  text: string
): Promise<void> {
  const proc = Bun.spawn(args, {
    stderr: "ignore",
    stdin: "pipe",
    stdout: "ignore",
  });
  proc.stdin.write(text);
  proc.stdin.end();
  await proc.exited.catch(() => {
    /* ignore exit errors */
  });
}

function getDarwinMethod(): ((text: string) => Promise<void>) | undefined {
  if (!Bun.which("osascript")) {
    return undefined;
  }
  return async (text: string) => {
    const escaped = text
      .replaceAll("\\", String.raw`\\`)
      .replaceAll('"', String.raw`\"`);
    await $`osascript -e 'set the clipboard to "${escaped}"'`.nothrow().quiet();
  };
}

function getLinuxWaylandMethod():
  | ((text: string) => Promise<void>)
  | undefined {
  if (process.env["WAYLAND_DISPLAY"] && Bun.which("wl-copy")) {
    return (text: string) => spawnClipboardWriter(["wl-copy"], text);
  }
  return undefined;
}

function getLinuxX11Method(): ((text: string) => Promise<void>) | undefined {
  if (Bun.which("xclip")) {
    return (text: string) =>
      spawnClipboardWriter(["xclip", "-selection", "clipboard"], text);
  }
  if (Bun.which("xsel")) {
    return (text: string) =>
      spawnClipboardWriter(["xsel", "--clipboard", "--input"], text);
  }
  return undefined;
}

const powershellCommand = [
  "powershell.exe",
  "-NonInteractive",
  "-NoProfile",
  "-Command",
  "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())",
];

function getWindowsMethod(): (text: string) => Promise<void> {
  return (text: string) => spawnClipboardWriter(powershellCommand, text);
}

function getPlatformMethod(): ((text: string) => Promise<void>) | undefined {
  const os = platform();

  if (os === "darwin") {
    return getDarwinMethod();
  }

  if (os === "linux") {
    return getLinuxWaylandMethod() ?? getLinuxX11Method();
  }

  if (os === "win32") {
    return getWindowsMethod();
  }

  return undefined;
}

const getCopyMethod = (() => {
  let method: ((text: string) => Promise<void>) | undefined;

  return (): ((text: string) => Promise<void>) => {
    if (method) {
      return method;
    }

    method =
      getPlatformMethod() ??
      (async () => {
        /* noop - no clipboard support */
      });
    return method;
  };
})();

export async function copyToClipboard(text: string): Promise<void> {
  writeOsc52(text);
  await getCopyMethod()(text);
}
