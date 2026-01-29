import { test, expect, describe } from "bun:test";
import { parseRepoSpec, repoSpecsMatch, type RepoSpec } from "../../src/types";

describe("parseRepoSpec", () => {
  test("parses owner/repo format", () => {
    const result = parseRepoSpec("facebook/react");
    expect(result).toEqual({
      spec: "facebook/react",
      owner: "facebook",
      name: "react",
      branch: undefined,
      dir: "react",
    });
  });

  test("parses owner/repo:branch format", () => {
    const result = parseRepoSpec("facebook/react:main");
    expect(result).toEqual({
      spec: "facebook/react:main",
      owner: "facebook",
      name: "react",
      branch: "main",
      dir: "react",
    });
  });

  test("parses repo with feature branch", () => {
    const result = parseRepoSpec("owner/repo:feature/my-branch");
    expect(result).toEqual({
      spec: "owner/repo:feature/my-branch",
      owner: "owner",
      name: "repo",
      branch: "feature/my-branch",
      dir: "repo",
    });
  });

  test("handles repo names with hyphens", () => {
    const result = parseRepoSpec("microsoft/vscode-extension");
    expect(result).toEqual({
      spec: "microsoft/vscode-extension",
      owner: "microsoft",
      name: "vscode-extension",
      branch: undefined,
      dir: "vscode-extension",
    });
  });

  test("handles repo names with dots", () => {
    const result = parseRepoSpec("owner/my.repo.name");
    expect(result).toEqual({
      spec: "owner/my.repo.name",
      owner: "owner",
      name: "my.repo.name",
      branch: undefined,
      dir: "my.repo.name",
    });
  });

  test("throws on missing slash", () => {
    expect(() => parseRepoSpec("invalid")).toThrow(
      "Invalid repo format: invalid (expected owner/repo or owner/repo:branch)",
    );
  });

  test("throws on empty owner", () => {
    expect(() => parseRepoSpec("/repo")).toThrow(
      "Invalid repo format: /repo (expected owner/repo or owner/repo:branch)",
    );
  });

  test("throws on empty name", () => {
    expect(() => parseRepoSpec("owner/")).toThrow(
      "Invalid repo format: owner/ (expected owner/repo or owner/repo:branch)",
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
      { spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" },
      { spec: "owner/repo2", owner: "owner", name: "repo2", dir: "repo2" },
    ];
    const b: RepoSpec[] = [
      { spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" },
      { spec: "owner/repo2", owner: "owner", name: "repo2", dir: "repo2" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(true);
  });

  test("returns true regardless of order", () => {
    const a: RepoSpec[] = [
      { spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" },
      { spec: "owner/repo2", owner: "owner", name: "repo2", dir: "repo2" },
    ];
    const b: RepoSpec[] = [
      { spec: "owner/repo2", owner: "owner", name: "repo2", dir: "repo2" },
      { spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(true);
  });

  test("returns true regardless of branch differences", () => {
    const a: RepoSpec[] = [
      { spec: "owner/repo:main", owner: "owner", name: "repo", branch: "main", dir: "repo" },
    ];
    const b: RepoSpec[] = [
      { spec: "owner/repo:develop", owner: "owner", name: "repo", branch: "develop", dir: "repo" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(true);
  });

  test("returns false for different lengths", () => {
    const a: RepoSpec[] = [{ spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" }];
    const b: RepoSpec[] = [
      { spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" },
      { spec: "owner/repo2", owner: "owner", name: "repo2", dir: "repo2" },
    ];
    expect(repoSpecsMatch(a, b)).toBe(false);
  });

  test("returns false for different repos", () => {
    const a: RepoSpec[] = [{ spec: "owner/repo1", owner: "owner", name: "repo1", dir: "repo1" }];
    const b: RepoSpec[] = [{ spec: "owner/repo2", owner: "owner", name: "repo2", dir: "repo2" }];
    expect(repoSpecsMatch(a, b)).toBe(false);
  });

  test("returns true for empty arrays", () => {
    expect(repoSpecsMatch([], [])).toBe(true);
  });

  test("returns false when owners differ", () => {
    const a: RepoSpec[] = [{ spec: "owner1/repo", owner: "owner1", name: "repo", dir: "repo" }];
    const b: RepoSpec[] = [{ spec: "owner2/repo", owner: "owner2", name: "repo", dir: "repo" }];
    expect(repoSpecsMatch(a, b)).toBe(false);
  });
});
