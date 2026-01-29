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

export function createCookingIndicator(
  renderer: CliRenderer,
  parent: { add: (child: unknown) => void; remove: (id: string) => void }
): CookingIndicator {
  const pair = FOOD_PAIRS[Math.floor(Math.random() * FOOD_PAIRS.length)] || [
    "🦐",
    "🍤",
  ];
  const raw = pair[0];
  const cooked = pair[1];

  const indicator = new TextRenderable(renderer, {
    content: "",
    fg: "#f8fafc",
    id: "cooking-indicator",
  });
  parent.add(indicator);

  let frame = 1;
  let direction = 1;
  let interval: NodeJS.Timeout | null = null;

  const render = () => {
    let content = "";
    for (let i = 0; i < COUNT; i++) {
      if (i < frame) {
        content += cooked;
      } else {
        content += raw;
      }
    }
    indicator.content = content;
  };

  const tick = () => {
    frame += direction;
    if (frame > COUNT) {
      frame = COUNT - 1;
      direction = -1;
    } else if (frame < 1) {
      frame = 1;
      direction = 1;
    }
    render();
  };

  const start = () => {
    if (interval) {return;}
    frame = 1;
    direction = 1;
    render();
    interval = setInterval(tick, FRAME_MS);
  };

  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    try {
      parent.remove("cooking-indicator");
    } catch {
      // Already removed
    }
  };

  const isRunning = () => interval !== null;

  return { isRunning, start, stop };
}
