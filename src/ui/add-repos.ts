import { type CliRenderer, InputRenderable, type KeyEvent, TextRenderable } from "@opentui/core";

import { listRepoHistory } from "../repo-history";
import { type RepoSpec, parseRepoSpec } from "../types";
import { showFooter, hideFooter } from "./common/footer";
import { isEnter, isEscape, isArrowUp, isArrowDown } from "./common/keyboard";
import { createBaseLayout, clearLayout } from "./renderer";

export interface AddReposResult {
  repos: RepoSpec[];
  cancelled: boolean;
}

export async function showAddReposPrompt(
  renderer: CliRenderer
): Promise<AddReposResult> {
  const history = await listRepoHistory();
  const historySpecs = history.map((item) => item.spec);
  const maxMatches = 6;

  return new Promise((resolve) => {
    clearLayout(renderer);

    const { content } = createBaseLayout(renderer, "Add repositories");

    const repos: RepoSpec[] = [];
    let currentInput = "";
    let currentReadOnly = false;
    let currentLatest = false;
    let currentValidRepo: RepoSpec | null = null;
    let selectedMatchIndex = -1; // -1 means no match selected, user is typing freely
    let lastQuery = ""; // Track the query that generated current matches
    let isNavigating = false; // Flag to prevent input handler from resetting when navigating
    let isConfirming = false; // Flag for confirmation mode (showing checkboxes)
    let confirmOptionIndex = 0; // 0 = read-only, 1 = confirm button

    // Repository input
    const repoLabel = new TextRenderable(renderer, {
      content: "Repository (owner/repo format):",
      fg: "#e2e8f0",
      id: "repo-label",
      marginBottom: 0,
    });
    content.add(repoLabel);

    const repoInput = new InputRenderable(renderer, {
      backgroundColor: "#334155",
      cursorColor: "#38bdf8",
      height: 1,
      id: "repo-input",
      marginTop: 1,
      placeholder: "e.g., microsoft/playwright",
      placeholderColor: "#64748b",
      textColor: "#f8fafc",
      width: 50,
    });
    content.add(repoInput);

    // Matches display
    const matchesLabel = new TextRenderable(renderer, {
      content: "Matches:",
      fg: "#94a3b8",
      id: "matches-label",
      marginTop: 1,
    });
    content.add(matchesLabel);

    const matchesList = new TextRenderable(renderer, {
      content: "(no matches)",
      fg: "#64748b",
      id: "matches-list",
      marginTop: 0,
    });
    content.add(matchesList);

    // Inline toggles (always visible when repo is valid)
    const detailsLabel = new TextRenderable(renderer, {
      content: "",
      fg: "#e2e8f0",
      id: "details-label",
      marginTop: 1,
    });
    content.add(detailsLabel);

    const detailsLatest = new TextRenderable(renderer, {
      content: "",
      fg: "#94a3b8",
      id: "details-latest",
      marginTop: 0,
    });
    content.add(detailsLatest);

    const confirmButton = new TextRenderable(renderer, {
      content: "",
      fg: "#10b981",
      id: "confirm-button",
      marginTop: 1,
    });
    content.add(confirmButton);

    repoInput.onPaste = (event) => {
      const text = event.text.replaceAll(/[\r\n]+/g, "");
      if (!text) {
        return;
      }
      repoInput.insertText(text);
      currentInput = repoInput.value;
      if (currentInput.trim()) {
        const repo = validateRepo(currentInput.trim());
        currentValidRepo = repo;
        if (repo) {
          currentReadOnly = false;
          currentLatest = false;
        }
      } else {
        statusText.content = "";
        currentValidRepo = null;
      }
      selectedMatchIndex = -1;
      lastQuery = currentInput;
      updateMatches();
      updateDetails();
      event.preventDefault();
    };

    // Status display
    const statusText = new TextRenderable(renderer, {
      content: "",
      fg: "#64748b",
      id: "status",
      marginTop: 1,
    });
    content.add(statusText);

    // Repos list with counter
    const reposLabel = new TextRenderable(renderer, {
      content: "\nAdded repositories:",
      fg: "#e2e8f0",
      id: "repos-label",
      marginTop: 1,
    });
    content.add(reposLabel);

    const reposList = new TextRenderable(renderer, {
      content: "(none)",
      fg: "#64748b",
      id: "repos-list",
      marginTop: 1,
    });
    content.add(reposList);

    repoInput.focus();

    function updateReposList() {
      if (repos.length === 0) {
        reposList.content = "(none)";
        reposList.fg = "#64748b";
      } else {
        reposList.content = repos
          .map((repo, i) => {
            const roMarker = repo.readOnly ? " [Read-only]" : "";
            return `  ${i + 1}. ${repo.spec}${roMarker}`;
          })
          .join("\n");
        reposList.fg = "#94a3b8";
      }
    }

    function updateDetails() {
      if (isConfirming && currentValidRepo) {
        // Confirmation mode with interactive checkboxes
        detailsLabel.content = `\nConfigure options for: ${currentInput.trim()}`;
        detailsLabel.fg = "#38bdf8";

        const latestCheckbox = currentLatest ? "[✓]" : "[ ]";
        const latestSelected = confirmOptionIndex === 0;
        detailsLatest.content = `  ${latestSelected ? "▶" : " "} ${latestCheckbox} Read-only [l]`;
        detailsLatest.fg = latestSelected
          ? "#f8fafc"
          : (currentLatest
            ? "#22d3ee"
            : "#94a3b8");

        const confirmSelected = confirmOptionIndex === 1;
        confirmButton.content = `  ${confirmSelected ? "▶" : " "} [Add repository]`;
        confirmButton.fg = confirmSelected ? "#10b981" : "#64748b";
      } else if (currentValidRepo) {
        detailsLabel.content = "\nPress Enter to configure options";
        detailsLabel.fg = "#64798b";
        detailsLatest.content = "";
        confirmButton.content = "";
      } else {
        detailsLabel.content = "";
        detailsLatest.content = "";
        confirmButton.content = "";
      }
    }

    function getMatchesForQuery(query: string): string[] {
      const trimmed = query.trim();
      if (!trimmed) {
        return [];
      }

      const lowerQuery = trimmed.toLowerCase();
      return historySpecs
        .filter((spec) => spec.toLowerCase().startsWith(lowerQuery))
        .toSorted((a, b) => {
          if (a.length !== b.length) {
            return a.length - b.length;
          }
          return a.localeCompare(b);
        })
        .slice(0, maxMatches);
    }

    function updateMatches() {
      const query = lastQuery; // Use the last query, not currentInput (which may be a selected match)
      const matches = getMatchesForQuery(query);

      if (matches.length === 0) {
        matchesList.content = "(no matches)";
        matchesList.fg = "#64748b";
        return;
      }

      matchesList.content = matches
        .map((spec, index) => {
          const isSelected = selectedMatchIndex === index;
          return `${isSelected ? "▶" : " "} ${spec}`;
        })
        .join("\n");
      matchesList.fg = "#94a3b8";
    }

    function validateRepo(spec: string): RepoSpec | null {
      try {
        const repo = parseRepoSpec(spec);
        statusText.content = "✓ Valid format";
        statusText.fg = "#10b981";
        return repo;
      } catch (error) {
        statusText.content = `✗ ${error instanceof Error ? error.message : "Invalid format"}`;
        statusText.fg = "#ef4444";
        return null;
      }
    }

    function selectMatch(matchIndex: number) {
      const matches = getMatchesForQuery(lastQuery);
      if (matchIndex < 0 || matchIndex >= matches.length) {
        return;
      }

      const selectedMatch = matches[matchIndex];
      if (!selectedMatch) {
        return;
      }

      selectedMatchIndex = matchIndex;
      isNavigating = true; // Set flag to prevent input handler from resetting

      // Update input with selected match
      repoInput.value = selectedMatch;
      repoInput.cursorPosition = selectedMatch.length; // Set cursor to end
      currentInput = selectedMatch;

      // Validate and update details
      const repo = validateRepo(selectedMatch.trim());
      currentValidRepo = repo;
      if (repo) {
        currentReadOnly = false;
        currentLatest = false;
      }

      updateMatches(); // Refresh display with new selection (matches stay the same, just highlight changes)
      updateDetails();

      isNavigating = false; // Reset flag
    }

    function addCurrentRepo() {
      if (!currentValidRepo) {
        return;
      }

      const spec = currentInput.trim();
      // Check if already added
      if (repos.some((r) => r.spec === spec)) {
        statusText.content = "⚠️ Repository already added";
        statusText.fg = "#f59e0b";
        return;
      }

      const repoToAdd = { ...currentValidRepo };
      repoToAdd.readOnly = currentReadOnly;
      repoToAdd.latest = currentLatest;
      repos.push(repoToAdd);

      currentInput = "";
      repoInput.value = "";
      currentValidRepo = null;
      currentReadOnly = false;
      currentLatest = false;
      updateReposList();
      lastQuery = "";
      selectedMatchIndex = -1;
      updateMatches();
      updateDetails();

      statusText.content = "";
    }

    function enterConfirmMode() {
      isConfirming = true;
      confirmOptionIndex = 2; // Start on confirm button for quick add
      repoInput.blur();
      updateDetails();
      updateFooter();
    }

    function exitConfirmMode() {
      isConfirming = false;
      confirmOptionIndex = 0;
      repoInput.focus();
      updateDetails();
      updateFooter();
    }

    function toggleCurrentOption() {
      if (confirmOptionIndex === 0) {
        // Toggle read-only
        currentLatest = !currentLatest;
        currentReadOnly = currentLatest;
      } else if (confirmOptionIndex === 1) {
        // Confirm button - add the repo
        addCurrentRepo();
        exitConfirmMode();
      }
      updateDetails();
    }

    function updateFooter() {
      if (isConfirming) {
        showFooter(renderer, content, {
          back: true,
          custom: ["l Read-only", "space Toggle", "enter Add"],
          navigate: true,
          select: false,
        });
      } else {
        showFooter(renderer, content, {
          back: true,
          custom: repos.length > 0 ? ["enter (empty) Continue"] : [],
          navigate: true,
          select: true,
        });
      }
    }

    const handleKeypress = (key: KeyEvent) => {
      // Escape behavior differs based on mode
      if (isEscape(key)) {
        if (isConfirming) {
          // Exit confirmation mode, go back to input
          exitConfirmMode();
          return;
        }
        cleanup();
        resolve({ cancelled: true, repos });
        return;
      }

      // Confirmation mode handling
      if (isConfirming) {
        // Toggle read-only with 'l' hotkey
        if (key.name === "l") {
          currentLatest = !currentLatest;
          currentReadOnly = currentLatest;
          updateDetails();
          return;
        }

        // Space to toggle current option
        if (key.name === "space") {
          toggleCurrentOption();
          return;
        }

        // Enter to confirm/add
        if (isEnter(key)) {
          addCurrentRepo();
          exitConfirmMode();
          return;
        }

        // Arrow keys to navigate options
        if (isArrowUp(key)) {
          confirmOptionIndex = Math.max(0, confirmOptionIndex - 1);
          updateDetails();
          return;
        }

        if (isArrowDown(key)) {
          confirmOptionIndex = Math.min(1, confirmOptionIndex + 1);
          updateDetails();
          return;
        }

        return;
      }

      // Normal input mode handling

      // Enter to enter confirmation mode or continue
      if (isEnter(key)) {
        if (currentInput.trim() && currentValidRepo) {
          enterConfirmMode();
        } else if (!currentInput.trim() && repos.length > 0) {
          // Empty input + repos added = continue
          cleanup();
          resolve({ cancelled: false, repos });
        }
        return;
      }

      // Arrow keys for navigating matches
      if (isArrowUp(key)) {
        const matches = getMatchesForQuery(lastQuery);
        if (matches.length === 0) {
          return;
        }

        if (selectedMatchIndex < 0) {
          // Start from last match
          selectedMatchIndex = matches.length - 1;
        } else {
          // Move up
          selectedMatchIndex = Math.max(0, selectedMatchIndex - 1);
        }
        selectMatch(selectedMatchIndex);
        return;
      }

      if (isArrowDown(key)) {
        const matches = getMatchesForQuery(lastQuery);
        if (matches.length === 0) {
          return;
        }

        if (selectedMatchIndex < 0) {
          // Start from first match
          selectedMatchIndex = 0;
        } else {
          // Move down
          selectedMatchIndex = Math.min(
            matches.length - 1,
            selectedMatchIndex + 1
          );
        }
        selectMatch(selectedMatchIndex);
        return;
      }
    };

    repoInput.on("input", (value: string) => {
      currentInput = value;

      // If we're navigating (programmatically setting value), don't reset selection
      if (isNavigating) {
        return;
      }

      // User is typing - reset selected match index and update query
      selectedMatchIndex = -1;
      lastQuery = value; // Update the query that generates matches

      if (value.trim()) {
        const repo = validateRepo(value.trim());
        currentValidRepo = repo;
        if (repo) {
          currentReadOnly = false;
          currentLatest = false;
        }
      } else {
        statusText.content = "";
        currentValidRepo = null;
      }
      updateMatches(); // Update matches based on new lastQuery
      updateDetails();
    });

    const cleanup = () => {
      renderer.keyInput.off("keypress", handleKeypress);
      repoInput.blur();
      hideFooter(renderer);
      clearLayout(renderer);
    };

    renderer.keyInput.on("keypress", handleKeypress);
    updateDetails();
    updateReposList();
    updateFooter();
  });
}
