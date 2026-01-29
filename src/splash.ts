export const block = (r: number, g: number, b: number): string =>
  `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;

export const palette: Record<string, string> = {
  ".": "  ",
  d: block(88, 62, 52), // dark brown
  l: block(121, 85, 72), // light brown (crust)
  r: block(214, 64, 36), // red (pepperoni)
  o: block(245, 124, 0), // orange
  y: block(255, 193, 7), // yellow (cheese)
  Y: block(255, 220, 80), // bright yellow (cheese highlight)
  g: block(76, 175, 80), // green (basil)
  k: block(20, 20, 20), // black (nori)
  w: block(236, 236, 236), // white (rice)
  b: block(79, 118, 170), // blue (fish)
  W: block(248, 250, 252), // white (text)
  // Fire colors
  R: block(255, 87, 34), // bright red/orange (fire)
  O: block(255, 152, 0), // bright orange (fire)
  F: block(255, 235, 59), // bright yellow (fire core)
};

export const foods = [
  // Pizza slice (7x7)
  ["..yy...", ".yyyy..", ".yryry.", "yyyyyyy", "yygyrry", "lllllll", "ddddddd"],
  // Burger (7x7)
  [".yyyyy.", "ggggggg", "rrrrrrr", "ddddddd", "ggggggg", "ooooooo", ".yyyyy."],
  // Fried egg (7x7)
  ["..www..", ".wwwww.", "wwwyyww", "wwyyyyw", "wwwyyww", ".wwwww.", "..www.."],
];

// Pixel art letters for "LETMECOOK" (7 rows each)
const pixelLetters: Record<string, string[]> = {
  L: ["WW...", "WW...", "WW...", "WW...", "WW...", "WW...", "WWWWW"],
  E: ["WWWWW", "WW...", "WW...", "WWWW.", "WW...", "WW...", "WWWWW"],
  T: ["WWWWWW", "..WW..", "..WW..", "..WW..", "..WW..", "..WW..", "..WW.."],
  M: [
    "WW...WW",
    "WWW.WWW",
    "WWWWWWW",
    "WW.W.WW",
    "WW...WW",
    "WW...WW",
    "WW...WW",
  ],
  C: [".WWWW", "WWWWW", "WW...", "WW...", "WW...", "WWWWW", ".WWWW"],
  O: [".WWWW.", "WWWWWW", "WW..WW", "WW..WW", "WW..WW", "WWWWWW", ".WWWW."],
  K: ["WW..WW", "WW.WW.", "WWWW..", "WWW...", "WWWW..", "WW.WW.", "WW..WW"],
};

export function renderFood(food: string[]): string {
  return food
    .map((row) =>
      row
        .split("")
        .map((cell) => palette[cell] ?? "  ")
        .join("")
    )
    .join("\n");
}

// Render a single row of pixel art from a pattern string
function renderRow(pattern: string): string {
  return pattern
    .split("")
    .map((cell) => palette[cell] ?? "  ")
    .join("");
}

// Generate fire row - intensity 1.0 = solid base, 0.0 = wispy tips
function generateFireRow(width: number, intensity: number): string {
  let row = "";

  for (let i = 0; i < width; i++) {
    // Base rows (high intensity) are always filled
    // Tip rows (low intensity) are sparse/wispy
    const shouldFill = Math.random() < intensity;

    if (shouldFill) {
      // Color varies based on intensity - base is more red/orange, tips are yellow
      if (intensity > 0.8) {
        // Solid base - mix of orange and red
        row += Math.random() < 0.5 ? "O" : "R";
      } else if (intensity > 0.5) {
        // Middle - yellow and orange
        row += Math.random() < 0.6 ? "F" : "O";
      } else {
        // Tips - mostly yellow, occasional orange
        row += Math.random() < 0.8 ? "F" : "O";
      }
    } else {
      row += ".";
    }
  }
  return row;
}

// Render the full logo: food + LETMECOOK + food
// Build the static logo rows (food + LETMECOOK + food) - called once
export function buildLogoRows(): string[] {
  const text = "LETMECOOK";

  // Build combined rows for LETMECOOK
  const letterRows: string[] = ["", "", "", "", "", "", ""];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char && pixelLetters[char]) {
      const letter = pixelLetters[char];
      for (let row = 0; row < 7; row++) {
        const letterRow = letter[row] ?? "";
        const targetRow = letterRows[row] ?? "";
        letterRows[row] = targetRow + letterRow;
        if (i < text.length - 1) {
          letterRows[row] += "."; // spacing between letters
        }
      }
    }
  }

  // Pick two random foods (different if possible)
  const leftFoodIndex = Math.floor(Math.random() * foods.length);
  let rightFoodIndex = Math.floor(Math.random() * foods.length);
  if (foods.length > 1 && rightFoodIndex === leftFoodIndex) {
    rightFoodIndex = (leftFoodIndex + 1) % foods.length;
  }

  const leftFood = foods[leftFoodIndex]!;
  const rightFood = foods[rightFoodIndex]!;

  // Spacing between food and text (in pattern chars, each becomes 2 terminal chars)
  const foodTextSpacing = ".."; // 2 pixels = 4 terminal chars

  // Build combined rows: leftFood + spacing + LETMECOOK + spacing + rightFood
  const logoRows: string[] = [];
  for (let row = 0; row < 7; row++) {
    const combined =
      leftFood[row] +
      foodTextSpacing +
      letterRows[row] +
      foodTextSpacing +
      rightFood[row];
    logoRows.push(renderRow(combined));
  }

  return logoRows;
}

// Render full frame with smoke, logo, and fire
export function renderLogo(logoRows?: string[]): string {
  // Build logo rows if not provided
  const rows = logoRows ?? buildLogoRows();

  // Calculate logo width for smoke/fire generation
  const logoWidth = 77; // matches actual logo width (7 + 2 + 59 + 2 + 7)

  // Render logo (top), gap, fire (below)
  const allRows: string[] = [];

  // Add logo rows
  allRows.push(...rows);

  // Add blank row gap between logo and fire
  allRows.push(renderRow(".".repeat(logoWidth)));

  // Add fire rows - wispy tips at top, solid base at bottom
  allRows.push(renderRow(generateFireRow(logoWidth, 0.2))); // wispy tips
  allRows.push(renderRow(generateFireRow(logoWidth, 0.4))); // sparse
  allRows.push(renderRow(generateFireRow(logoWidth, 0.6))); // medium
  allRows.push(renderRow(generateFireRow(logoWidth, 0.85))); // dense
  allRows.push(renderRow(generateFireRow(logoWidth, 0.98))); // solid base

  return allRows.join("\n");
}

export async function showSplash(): Promise<void> {
  const termWidth = process.stdout.columns || 80;
  const termHeight = process.stdout.rows || 24;

  // Animation settings
  const totalDuration = 3000; // 3 seconds total
  const frameDelay = 100; // 100ms per frame
  const frameCount = Math.floor(totalDuration / frameDelay);

  // Build static logo rows once (foods stay the same)
  const logoRows = buildLogoRows();

  console.clear();

  for (let frame = 0; frame < frameCount; frame++) {
    const art = renderLogo(logoRows);
    const artLines = art.split("\n");

    // Calculate centering
    // eslint-disable-next-line no-control-regex -- ANSI escape codes require control chars
    const firstRowWidth = (artLines[0] ?? "").replace(
      /\x1b\[[0-9;]*m/g,
      ""
    ).length;
    const hPadding = Math.max(0, Math.floor((termWidth - firstRowWidth) / 2));
    const paddedArt = artLines
      .map((row) => " ".repeat(hPadding) + row)
      .join("\n");

    const artHeight = artLines.length;
    const vPadding = Math.max(0, Math.floor((termHeight - artHeight) / 2));

    // Move cursor to top-left and redraw (avoids flicker from clear)
    process.stdout.write("\x1b[H"); // cursor to home
    process.stdout.write("\n".repeat(vPadding) + paddedArt);

    await Bun.sleep(frameDelay);
  }

  console.clear();
}
