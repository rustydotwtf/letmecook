import { test, expect, describe } from "bun:test";

import { parseRepos } from "../../src/cli-mode";

describe("parseRepos", () => {
  test("parses single repo", () => {
    const repos = parseRepos(["owner/repo"]);
    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual({
      spec: "owner/repo",
      owner: "owner",
      name: "repo",
      branch: undefined,
      dir: "repo",
    });
  });

  test("parses multiple repos", () => {
    const repos = parseRepos(["facebook/react", "microsoft/playwright"]);
    expect(repos).toHaveLength(2);
    expect(repos[0]?.owner).toBe("facebook");
    expect(repos[0]?.name).toBe("react");
    expect(repos[1]?.owner).toBe("microsoft");
    expect(repos[1]?.name).toBe("playwright");
  });

  test("parses repos with branches", () => {
    const repos = parseRepos(["owner/repo:main", "owner/other:feature-branch"]);
    expect(repos).toHaveLength(2);
    expect(repos[0]?.branch).toBe("main");
    expect(repos[1]?.branch).toBe("feature-branch");
  });

  test("skips flags in args", () => {
    const repos = parseRepos(["owner/repo", "--some-flag", "other/repo"]);
    expect(repos).toHaveLength(2);
    expect(repos[0]?.name).toBe("repo");
    expect(repos[1]?.name).toBe("repo");
  });

  test("skips empty args", () => {
    const repos = parseRepos(["", "owner/repo", ""]);
    expect(repos).toHaveLength(1);
    expect(repos[0]?.name).toBe("repo");
  });

  test("returns empty array for no repos", () => {
    const repos = parseRepos([]);
    expect(repos).toHaveLength(0);
  });

  test("returns empty array for flags only", () => {
    const repos = parseRepos(["--flag", "-f"]);
    expect(repos).toHaveLength(0);
  });

  test("throws on invalid repo format", () => {
    expect(() => parseRepos(["invalid"])).toThrow(
      "Invalid repo format: invalid (expected owner/repo)"
    );
  });

  test("handles complex branch names with slashes", () => {
    const repos = parseRepos(["owner/repo:feature/my-feature"]);
    expect(repos).toHaveLength(1);
    expect(repos[0]?.branch).toBe("feature/my-feature");
  });
});
