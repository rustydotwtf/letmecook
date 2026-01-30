function processTextChunk(
  chunk: Uint8Array,
  decoder: TextDecoder,
  buffer: { value: string },
  addLine: (line: string) => void
) {
  const text = decoder.decode(chunk, { stream: true });
  buffer.value += text;

  const lines = buffer.value.split(/[\r\n]+/);
  buffer.value = lines.pop() || "";

  for (const line of lines) {
    addLine(line);
  }
}

function checkAndStop(reader: unknown, shouldStop?: () => boolean): boolean {
  if (shouldStop?.()) {
    (reader as { releaseLock: () => void }).releaseLock();
    return true;
  }
  return false;
}

async function readStreamIteration(
  reader: unknown,
  decoder: TextDecoder,
  buffer: { value: string },
  addLine: (line: string) => void
): Promise<boolean> {
  const { done, value } = await (
    reader as {
      read: () => Promise<{
        done: boolean;
        value: Uint8Array;
      }>;
    }
  ).read();

  if (done) {
    return true;
  }

  processTextChunk(value, decoder, buffer, addLine);
  return false;
}

async function readStreamLoop(
  reader: unknown,
  decoder: TextDecoder,
  buffer: { value: string },
  addLine: (line: string) => void,
  onChunk?: (chunk: string) => void,
  shouldStop?: () => boolean
): Promise<boolean> {
  while (true) {
    if (checkAndStop(reader, shouldStop)) {
      return true;
    }

    const shouldBreak = await readStreamIteration(
      reader,
      decoder,
      buffer,
      addLine
    );

    if (shouldBreak || checkAndStop(reader, shouldStop)) {
      return shouldBreak || true;
    }
  }
}

async function readStreamLines(
  stream: ReadableStream<Uint8Array> | number | undefined,
  addLine: (line: string) => void,
  onChunk?: (chunk: string) => void,
  shouldStop?: () => boolean
): Promise<boolean> {
  if (!stream || typeof stream === "number") {
    return false;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const buffer = { value: "" };

  try {
    const wasInterrupted = await readStreamLoop(
      reader,
      decoder,
      buffer,
      addLine,
      onChunk,
      shouldStop
    );
    return wasInterrupted;
  } catch {
    // Stream may have been cancelled
  }

  return false;
}

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

  await Promise.all([
    readStreamLines(proc.stdout, addLine),
    readStreamLines(proc.stderr, addLine),
  ]);
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
  const fullOutputParts: string[] = [];

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

  const onChunk = (chunk: string) => {
    fullOutputParts.push(chunk);
  };

  await Promise.all([
    readStreamLines(proc.stdout, addLine, onChunk),
    readStreamLines(proc.stderr, addLine, onChunk),
  ]);
  const exitCode = await proc.exited;

  return {
    fullOutput: fullOutputParts.join(""),
    output: outputBuffer,
    success: exitCode === 0,
  };
}

async function waitForExitCode(
  proc: ReturnType<typeof Bun.spawn>,
  wasInterrupted: boolean
): Promise<number> {
  if (!wasInterrupted) {
    return await proc.exited;
  }
  return 1;
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
  const fullOutputParts: string[] = [];

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

  const onChunk = (chunk: string) => {
    fullOutputParts.push(chunk);
  };

  const [stdoutInterrupted, stderrInterrupted] = await Promise.all([
    readStreamLines(proc.stdout, addLine, onChunk, shouldStop),
    readStreamLines(proc.stderr, addLine, onChunk, shouldStop),
  ]);

  const wasInterrupted = stdoutInterrupted || stderrInterrupted;
  const exitCode = await waitForExitCode(proc, wasInterrupted);

  return {
    fullOutput: fullOutputParts.join(""),
    output: outputBuffer,
    success: !wasInterrupted && exitCode === 0,
    wasInterrupted,
  };
}
