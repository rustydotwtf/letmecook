import { type CliRenderer, TextRenderable } from "@opentui/core";

// [uncooked, cooked] emoji pairs
const FOOD_PAIRS: [string, string][] = [
  ["🦐", "🍤"], // shrimp
  ["🥔", "🍟"], // potato
  ["🐷", "🥓"], // bacon
  ["🥚", "🍳"], // egg
  ["🥩", "🍖"], // meat
  ["🌽", "🍿"], // corn
];

const COUNT = 5;
const FRAME_MS = 120;

export interface CookingIndicator {
  start: () => void;
  stop: () => void;
  isRunning: () => boolean;
}

function selectFoodPair(): [string, string] {
  return (
    FOOD_PAIRS[Math.floor(Math.random() * FOOD_PAIRS.length)] || ["🦐", "🍤"]
  );
}

function createTickFunction(
  state: { frame: { value: number }; direction: { value: number } },
  render: () => void
): () => void {
  return () => {
    state.frame.value += state.direction.value;
    if (state.frame.value > COUNT) {
      state.frame.value = COUNT - 1;
      state.direction.value = -1;
    } else if (state.frame.value < 1) {
      state.frame.value = 1;
      state.direction.value = 1;
    }
    render();
  };
}

function createStartStopFunctions(
  state: {
    frame: { value: number };
    direction: { value: number };
    interval: { value: NodeJS.Timeout | null };
  },
  tick: () => void,
  parent: { remove: (id: string) => void }
): { isRunning: () => boolean; start: () => void; stop: () => void } {
  const start = () => {
    if (state.interval.value) {
      return;
    }
    state.frame.value = 1;
    state.direction.value = 1;
    tick();
    state.interval.value = setInterval(tick, FRAME_MS);
  };

  const stop = () => {
    if (state.interval.value) {
      clearInterval(state.interval.value);
      state.interval.value = null;
    }
    try {
      parent.remove("cooking-indicator");
    } catch {
      // Already removed
    }
  };

  const isRunning = () => state.interval.value !== null;

  return { isRunning, start, stop };
}

function createIndicator(
  renderer: CliRenderer,
  parent: { add: (child: unknown) => void; remove: (id: string) => void },
  raw: string,
  cooked: string
): { isRunning: () => boolean; start: () => void; stop: () => void } {
  const indicator = new TextRenderable(renderer, {
    content: "",
    fg: "#f8fafc",
    id: "cooking-indicator",
  });
  parent.add(indicator);

  const state = {
    direction: { value: 1 },
    frame: { value: 1 },
    interval: { value: null as NodeJS.Timeout | null },
  };

  const render = () => {
    let content = "";
    for (let i = 0; i < COUNT; i += 1) {
      content += i < state.frame.value ? cooked : raw;
    }
    indicator.content = content;
  };

  const tick = createTickFunction(state, render);
  return createStartStopFunctions(state, tick, parent);
}

export function createCookingIndicator(
  renderer: CliRenderer,
  parent: { add: (child: unknown) => void; remove: (id: string) => void }
): CookingIndicator {
  const [raw, cooked] = selectFoodPair();
  return createIndicator(renderer, parent, raw, cooked);
}
