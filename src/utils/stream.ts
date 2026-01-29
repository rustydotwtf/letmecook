export async function readProcessOutput(
  proc: ReturnType<typeof Bun.spawn>,
  onOutput?: (line: string) => void
): Promise<{ success: boolean; output: string[] }> {
  const outputBuffer: string[] = [];
  const addLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) {
      outputBuffer.push(trimmed);
      onOutput?.(trimmed);
    }
  };

  const readStream = async (
    stream: ReadableStream<Uint8Array> | number | undefined
  ) => {
    if (!stream || typeof stream === "number") {return;}

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {break;}
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split(/[\r\n]+/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        addLine(line);
      }
    }

    if (buffer.trim()) {
      addLine(buffer);
    }
  };

  await Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);
  const exitCode = await proc.exited;

  return {
    output: outputBuffer,
    success: exitCode === 0,
  };
}

interface ReadProcessOutputWithBufferOptions {
  maxBufferLines?: number;
  onBufferUpdate?: (buffer: string[]) => void;
}

export interface ReadWithControlOptions {
  maxBufferLines?: number;
  onBufferUpdate?: (buffer: string[]) => void;
  shouldStop?: () => boolean; // Check if we should stop early
}

export async function readProcessOutputWithBuffer(
  proc: ReturnType<typeof Bun.spawn>,
  options?: ReadProcessOutputWithBufferOptions
): Promise<{ success: boolean; output: string[]; fullOutput: string }> {
  const { maxBufferLines, onBufferUpdate } = options || {};
  const outputBuffer: string[] = [];
  const addLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) {
      outputBuffer.push(trimmed);
      if (maxBufferLines && outputBuffer.length > maxBufferLines) {
        outputBuffer.shift();
      }
      onBufferUpdate?.([...outputBuffer]);
    }
  };

  const fullOutputParts: string[] = [];

  const readStream = async (
    stream: ReadableStream<Uint8Array> | number | undefined
  ) => {
    if (!stream || typeof stream === "number") {return;}

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {break;}
      const chunk = decoder.decode(value, { stream: true });
      fullOutputParts.push(chunk);
      buffer += chunk;

      const lines = buffer.split(/[\r\n]+/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        addLine(line);
      }
    }

    if (buffer.trim()) {
      addLine(buffer);
    }
  };

  await Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);
  const exitCode = await proc.exited;

  return {
    fullOutput: fullOutputParts.join(""),
    output: outputBuffer,
    success: exitCode === 0,
  };
}

export async function readProcessOutputWithControl(
  proc: ReturnType<typeof Bun.spawn>,
  options?: ReadWithControlOptions
): Promise<{
  success: boolean;
  output: string[];
  fullOutput: string;
  wasInterrupted: boolean;
}> {
  const { maxBufferLines, onBufferUpdate, shouldStop } = options || {};
  const outputBuffer: string[] = [];
  let wasInterrupted = false;

  const addLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) {
      outputBuffer.push(trimmed);
      if (maxBufferLines && outputBuffer.length > maxBufferLines) {
        outputBuffer.shift();
      }
      onBufferUpdate?.([...outputBuffer]);
    }
  };

  const fullOutputParts: string[] = [];

  const readStream = async (
    stream: ReadableStream<Uint8Array> | number | undefined
  ) => {
    if (!stream || typeof stream === "number") {return;}

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        // Check if we should stop before each read
        if (shouldStop?.()) {
          wasInterrupted = true;
          reader.releaseLock();
          return;
        }

        const { done, value } = await reader.read();
        if (done) {break;}

        const chunk = decoder.decode(value, { stream: true });
        fullOutputParts.push(chunk);
        buffer += chunk;

        const lines = buffer.split(/[\r\n]+/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          addLine(line);
        }

        // Check again after processing
        if (shouldStop?.()) {
          wasInterrupted = true;
          reader.releaseLock();
          return;
        }
      }

      if (buffer.trim()) {
        addLine(buffer);
      }
    } catch {
      // Stream may have been cancelled, that's ok
    }
  };

  await Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);

  // Only wait for exit if not interrupted
  let exitCode = 1;
  if (!wasInterrupted) {
    exitCode = await proc.exited;
  }

  return {
    fullOutput: fullOutputParts.join(""),
    output: outputBuffer,
    success: !wasInterrupted && exitCode === 0,
    wasInterrupted,
  };
}
