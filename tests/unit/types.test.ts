import { describe, expect, test } from "bun:test";

import { parseRepoSpec, type RepoSpec, repoSpecsMatch } from "../../src/types";

describe("parseRepoSpec", () => {
  test("parses owner/repo format", () => {
    const result = parseRepoSpec("facebook/react");
    expect(result).toEqual({
      branch: undefined,
      dir: "react",
      name: "react",
      owner: "facebook",
      spec: "facebook/react",
    });
  });

  test("parses owner/repo:branch format", () => {
    const result = parseRepoSpec("facebook/react:main");
    expect(result).toEqual({
      branch: "main",
      dir: "react",
      name: "react",
      owner: "facebook",
      spec: "facebook/react:main",
    });
  });

  test("parses repo with feature branch", () => {
    const result = parseRepoSpec("owner/repo:feature/my-branch");
    expect(result).toEqual({
      branch: "feature/my-branch",
      dir: "repo",
      name: "repo",
      owner: "owner",
      spec: "owner/repo:feature/my-branch",
    });
  });

  test("handles repo names with hyphens", () => {
    const result = parseRepoSpec("microsoft/vscode-extension");
    expect(result).toEqual({
      branch: undefined,
      dir: "vscode-extension",
      name: "vscode-extension",
      owner: "microsoft",
      spec: "microsoft/vscode-extension",
    });
  });

  test("handles repo names with dots", () => {
    const result = parseRepoSpec("owner/my.repo.name");
    expect(result).toEqual({
      branch: undefined,
      dir: "my.repo.name",
      name: "my.repo.name",
      owner: "owner",
      spec: "owner/my.repo.name",
    });
  });

  test("throws on missing slash", () => {
    expect(() => parseRepoSpec("invalid")).toThrow(
      "Invalid repo format: invalid (expected owner/repo or owner/repo:branch)"
    );
  });

  test("throws on empty owner", () => {
    expect(() => parseRepoSpec("/repo")).toThrow(
      "Invalid repo format: /repo (expected owner/repo or owner/repo:branch)"
    );
  });

  test("throws on empty name", () => {
    expect(() => parseRepoSpec("owner/")).toThrow(
      "Invalid repo format: owner/ (expected owner/repo or owner/repo:branch)"
    );
  });

  test("handles empty branch after colon", () => {
    const result = parseRepoSpec("owner/repo:");
    expect(result.branch).toBe("");
  });
});

describe("repoSpecsMatch", () => {
  test("returns true for identical repo sets", () => {
    const a: RepoSpec[] = [
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
      { dir: "repo2", name: "repo2", owner: "owner", spec: "owner/repo2" },
    ];
    const b: RepoSpec[] = [
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
      { dir: "repo2", name: "repo2", owner: "owner", spec: "owner/repo2" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(true);
  });

  test("returns true regardless of order", () => {
    const a: RepoSpec[] = [
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
      { dir: "repo2", name: "repo2", owner: "owner", spec: "owner/repo2" },
    ];
    const b: RepoSpec[] = [
      { dir: "repo2", name: "repo2", owner: "owner", spec: "owner/repo2" },
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(true);
  });

  test("returns true regardless of branch differences", () => {
    const a: RepoSpec[] = [
      {
        branch: "main",
        dir: "repo",
        name: "repo",
        owner: "owner",
        spec: "owner/repo:main",
      },
    ];
    const b: RepoSpec[] = [
      {
        branch: "develop",
        dir: "repo",
        name: "repo",
        owner: "owner",
        spec: "owner/repo:develop",
      },
    ];
    expect(repoSpecsMatch(a, b)).toBe(true);
  });

  test("returns false for different lengths", () => {
    const a: RepoSpec[] = [
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
    ];
    const b: RepoSpec[] = [
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
      { dir: "repo2", name: "repo2", owner: "owner", spec: "owner/repo2" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(false);
  });

  test("returns false for different repos", () => {
    const a: RepoSpec[] = [
      { dir: "repo1", name: "repo1", owner: "owner", spec: "owner/repo1" },
    ];
    const b: RepoSpec[] = [
      { dir: "repo2", name: "repo2", owner: "owner", spec: "owner/repo2" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(false);
  });

  test("returns true for empty arrays", () => {
    expect(repoSpecsMatch([], [])).toBe(true);
  });

  test("returns false when owners differ", () => {
    const a: RepoSpec[] = [
      { dir: "repo", name: "repo", owner: "owner1", spec: "owner1/repo" },
    ];
    const b: RepoSpec[] = [
      { dir: "repo", name: "repo", owner: "owner2", spec: "owner2/repo" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(false);
  });
});
