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

const getCopyMethod = (() => {
  let method: ((text: string) => Promise<void>) | undefined;

  return (): ((text: string) => Promise<void>) => {
    if (method) {
      return method;
    }

    const os = platform();

    if (os === "darwin" && Bun.which("osascript")) {
      method = async (text: string) => {
        const escaped = text
          .replaceAll('\\', String.raw`\\`)
          .replaceAll('"', String.raw`\"`);
        await $`osascript -e 'set the clipboard to "${escaped}"'`
          .nothrow()
          .quiet();
      };
      return method;
    }

    if (os === "linux") {
      if (process.env["WAYLAND_DISPLAY"] && Bun.which("wl-copy")) {
        method = async (text: string) => {
          const proc = Bun.spawn(["wl-copy"], {
            stderr: "ignore",
            stdin: "pipe",
            stdout: "ignore",
          });
          proc.stdin.write(text);
          proc.stdin.end();
          await proc.exited.catch(() => { /* ignore exit errors */ });
        };
        return method;
      }
      if (Bun.which("xclip")) {
        method = async (text: string) => {
          const proc = Bun.spawn(["xclip", "-selection", "clipboard"], {
            stderr: "ignore",
            stdin: "pipe",
            stdout: "ignore",
          });
          proc.stdin.write(text);
          proc.stdin.end();
          await proc.exited.catch(() => { /* ignore exit errors */ });
        };
        return method;
      }
      if (Bun.which("xsel")) {
        method = async (text: string) => {
          const proc = Bun.spawn(["xsel", "--clipboard", "--input"], {
            stderr: "ignore",
            stdin: "pipe",
            stdout: "ignore",
          });
          proc.stdin.write(text);
          proc.stdin.end();
          await proc.exited.catch(() => { /* ignore exit errors */ });
        };
        return method;
      }
    }

    if (os === "win32") {
      method = async (text: string) => {
        const proc = Bun.spawn(
          [
            "powershell.exe",
            "-NonInteractive",
            "-NoProfile",
            "-Command",
            "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())",
          ],
          { stderr: "ignore", stdin: "pipe", stdout: "ignore" }
        );
        proc.stdin.write(text);
        proc.stdin.end();
        await proc.exited.catch(() => { /* ignore exit errors */ });
      };
      return method;
    }

    // Fallback: no clipboard support
    method = async () => { /* noop - no clipboard support */ };
    return method;
  };
})();

export async function copyToClipboard(text: string): Promise<void> {
  writeOsc52(text);
  await getCopyMethod()(text);
}
