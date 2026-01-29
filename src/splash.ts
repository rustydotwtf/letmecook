export const block = (r: number, g: number, b: number): string =>
  `\u001B[48;2;${r};${g};${b}m  \u001B[0m`;

export const palette: Record<string, string> = {
  ".": "  ",
  B: block(79, 118, 170),
  D: block(88, 62, 52),
  E: block(245, 124, 0),
  F: block(255, 235, 59),
  G: block(76, 175, 80),
  I: block(236, 236, 236),
  K: block(20, 20, 20),
  L: block(121, 85, 72),
  N: block(214, 64, 36),
  O: block(255, 152, 0),
  R: block(255, 87, 34),
  T: block(255, 193, 7),
  W: block(248, 250, 252),
  Y: block(255, 220, 80),
};

export const foods = [
  ["..tt...", ".tttt..", ".tntnt.", "ttttttt", "ttgtntt", "lllllll", "ddddddd"],
  [".ttttt.", "ggggggg", "nnnnnnn", "ddddddd", "ggggggg", "eeeeeee", ".ttttt."],
  [
    "..iii..",
    ".iiiii.",
    "ii ttii",
    "ii tt ii",
    "ii ttii",
    ".iiiii.",
    "..iii..",
  ],
];

const pixelLetters: Record<string, string[]> = {
  C: [".WWWW", "WWWWW", "WW...", "WW...", "WW...", "WWWWW", ".WWWW"],
  E: ["WWWWW", "WW...", "WW...", "WWWW.", "WW...", "WW...", "WWWWW"],
  K: ["WW..WW", "WW.WW.", "WWWW..", "WWW...", "WWWW..", "WW.WW.", "WW..WW"],
  L: ["WW...", "WW...", "WW...", "WW...", "WW...", "WW...", "WWWWW"],
  M: [
    "WW...WW",
    "WWW.WWW",
    "WWWWWWW",
    "WW.W.WW",
    "WW...WW",
    "WW...WW",
    "WW...WW",
  ],
  O: [".WWWW.", "WWWWWW", "WW..WW", "WW..WW", "WW..WW", "WWWWWW", ".WWWW."],
  T: ["WWWWWW", "..WW..", "..WW..", "..WW..", "..WW..", "..WW..", "..WW.."],
};

export function renderFood(food: string[]): string {
  return food
    .map((row) => [...row].map((cell) => palette[cell] ?? "  ").join(""))
    .join("\n");
}

function renderRow(pattern: string): string {
  return [...pattern].map((cell) => palette[cell] ?? "  ").join("");
}

function getFireChar(intensity: number): string {
  if (intensity > 0.8) {
    return Math.random() < 0.5 ? "O" : "R";
  }
  if (intensity > 0.5) {
    return Math.random() < 0.6 ? "F" : "O";
  }
  return Math.random() < 0.8 ? "F" : "O";
}

function generateFireRow(width: number, intensity: number): string {
  const rowParts: string[] = [];
  for (let i = 0; i < width; i += 1) {
    const shouldFill = Math.random() < intensity;
    rowParts.push(shouldFill ? getFireChar(intensity) : ".");
  }
  return rowParts.join("");
}

function processLetter(
  char: string,
  index: number,
  text: string,
  letterRows: string[]
): void {
  if (char && pixelLetters[char]) {
    const letter = pixelLetters[char];
    for (let row = 0; row < 7; row += 1) {
      const letterRow = letter[row] ?? "";
      const targetRow = letterRows[row] ?? "";
      letterRows[row] = targetRow + letterRow;
      if (index < text.length - 1) {
        letterRows[row] += ".";
      }
    }
  }
}

function getLetterRows(text: string): string[] {
  const letterRows = ["", "", "", "", "", "", ""];
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char !== undefined) {
      processLetter(char, i, text, letterRows);
    }
  }
  return letterRows;
}

const defaultFood = [
  ".......",
  ".......",
  ".......",
  ".......",
  ".......",
  ".......",
  ".......",
];

function getFoods(): [number, number] {
  const leftFoodIndex = Math.floor(Math.random() * foods.length);
  let rightFoodIndex = Math.floor(Math.random() * foods.length);
  if (foods.length > 1 && rightFoodIndex === leftFoodIndex) {
    rightFoodIndex = (leftFoodIndex + 1) % foods.length;
  }
  return [leftFoodIndex, rightFoodIndex];
}

function buildCombinedRow(
  leftFoodRow: string,
  letterRow: string,
  rightFoodRow: string,
  spacing: string
): string {
  return leftFoodRow + spacing + letterRow + spacing + rightFoodRow;
}

function selectFoodsForLogo(): [string[], string[]] {
  const [leftFoodIndex, rightFoodIndex] = getFoods();
  const leftFood = foods[leftFoodIndex] ?? defaultFood;
  const rightFood = foods[rightFoodIndex] ?? defaultFood;
  return [leftFood, rightFood];
}

export function buildLogoRows(): string[] {
  const text = "LETMECOOK";
  const letterRows = getLetterRows(text);
  const [leftFood, rightFood] = selectFoodsForLogo();
  const foodTextSpacing = "..";
  const logoRows: string[] = [];
  for (let row = 0; row < 7; row += 1) {
    const combined = buildCombinedRow(
      leftFood[row] ?? "",
      letterRows[row] ?? "",
      rightFood[row] ?? "",
      foodTextSpacing
    );
    logoRows.push(renderRow(combined));
  }
  return logoRows;
}

export function renderLogo(logoRows?: string[]): string {
  const rows = logoRows ?? buildLogoRows();
  const logoWidth = 77;

  return [
    ...rows,
    renderRow(".".repeat(logoWidth)),
    renderRow(generateFireRow(logoWidth, 0.2)),
    renderRow(generateFireRow(logoWidth, 0.4)),
    renderRow(generateFireRow(logoWidth, 0.6)),
    renderRow(generateFireRow(logoWidth, 0.85)),
    renderRow(generateFireRow(logoWidth, 0.98)),
  ].join("\n");
}

// eslint-disable-next-line no-control-regex -- ANSI escape codes require control chars
const ANSI_ESCAPE_REGEX = /\u001B\[[0-9;]*m/g;

function getTermDimensions(): [number, number] {
  const termWidth = process.stdout.columns || 80;
  const termHeight = process.stdout.rows || 24;
  return [termWidth, termHeight];
}

function calculatePadding(
  art: string,
  termWidth: number,
  termHeight: number
): [number, number] {
  const artLines = art.split("\n");
  const firstRowWidth = (artLines[0] ?? "").replaceAll(
    ANSI_ESCAPE_REGEX,
    ""
  ).length;
  const hPadding = Math.max(0, Math.floor((termWidth - firstRowWidth) / 2));
  const vPadding = Math.max(0, Math.floor((termHeight - artLines.length) / 2));
  return [hPadding, vPadding];
}

function centerArt(art: string, hPadding: number): string {
  return art
    .split("\n")
    .map((row) => " ".repeat(hPadding) + row)
    .join("\n");
}

function renderFrame(
  logoRows: string[],
  termWidth: number,
  termHeight: number
): string {
  const art = renderLogo(logoRows);
  const [hPadding, vPadding] = calculatePadding(art, termWidth, termHeight);
  const paddedArt = centerArt(art, hPadding);
  return "\n".repeat(vPadding) + paddedArt;
}

function getAnimationSettings(): [number, number, number] {
  const totalDuration = 3000;
  const frameDelay = 100;
  const frameCount = Math.floor(totalDuration / frameDelay);
  return [totalDuration, frameDelay, frameCount];
}

export async function showSplash(): Promise<void> {
  const [termWidth, termHeight] = getTermDimensions();
  const [frameDelay, frameCount] = getAnimationSettings();
  const logoRows = buildLogoRows();
  const cursorHome = "\u001B[H";

  console.clear();

  for (let frame = 0; frame < frameCount; frame += 1) {
    const display = renderFrame(logoRows, termWidth, termHeight);
    process.stdout.write(`${cursorHome}${display}`);
    await Bun.sleep(frameDelay);
  }

  console.clear();
}
