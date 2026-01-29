import {
  RepoSpecSchema,
  SessionManifestSchema,
  NewSessionParamsSchema,
  type RepoSpec,
  type SessionManifest,
  type NewSessionParams,
} from "./schemas";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export function formatZodError(error: unknown): string[] {
  if (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    const issues = (
      error as { issues: { path: PropertyKey[]; message: string }[] }
    ).issues;
    return issues.map((e) => {
      const path = e.path.length > 0 ? String(e.path.join(".")) : "root";
      return `${path}: ${e.message}`;
    });
  }
  return ["Unknown validation error"];
}

export function validateRepoSpec(spec: string): RepoSpec {
  const parsed = parseRepoSpec(spec);
  const result = RepoSpecSchema.safeParse(parsed);

  if (!result.success) {
    const errors = formatZodError(result.error);
    throw new Error(`Invalid repo spec: ${errors.join(", ")}`);
  }

  return result.data;
}

export function validateRepoSpecSafe(spec: string): ValidationResult<RepoSpec> {
  try {
    const parsed = parseRepoSpec(spec);
    const result = RepoSpecSchema.safeParse(parsed);

    if (!result.success) {
      return {
        success: false,
        errors: formatZodError(result.error),
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

export function validateSessionManifest(manifest: unknown): SessionManifest {
  const result = SessionManifestSchema.safeParse(manifest);

  if (!result.success) {
    const errors = formatZodError(result.error);
    throw new Error(`Invalid session manifest: ${errors.join(", ")}`);
  }

  return result.data;
}

export function validateSessionManifestSafe(
  manifest: unknown
): ValidationResult<SessionManifest> {
  const result = SessionManifestSchema.safeParse(manifest);

  if (!result.success) {
    return {
      success: false,
      errors: formatZodError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

export function validateNewSessionParams(params: unknown): NewSessionParams {
  const result = NewSessionParamsSchema.safeParse(params);

  if (!result.success) {
    const errors = formatZodError(result.error);
    throw new Error(`Invalid session params: ${errors.join(", ")}`);
  }

  return result.data;
}

export function validateNewSessionParamsSafe(
  params: unknown
): ValidationResult<NewSessionParams> {
  const result = NewSessionParamsSchema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      errors: formatZodError(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

function parseRepoSpec(spec: string): {
  spec: string;
  owner: string;
  name: string;
  branch?: string;
  dir: string;
} {
  const colonIndex = spec.indexOf(":");
  const repoPath = colonIndex === -1 ? spec : spec.slice(0, colonIndex);
  const branch = colonIndex === -1 ? undefined : spec.slice(colonIndex + 1);

  const slashIndex = repoPath.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(
      `Invalid repo format: ${spec} (expected owner/repo or owner/repo:branch)`
    );
  }

  const owner = repoPath.slice(0, slashIndex);
  const name = repoPath.slice(slashIndex + 1);

  if (!owner || !name) {
    throw new Error(
      `Invalid repo format: ${spec} (expected owner/repo or owner/repo:branch)`
    );
  }

  return {
    spec,
    owner,
    name,
    branch,
    dir: name,
  };
}
