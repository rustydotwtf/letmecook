import type { Session } from "../types";

export interface SessionOption {
  name: string;
  description: string;
  value: Session;
}

function formatTimeAgo(date: string): string {
  const [diffMins, diffHours, diffDays] = (() => {
    const diffMs = Date.now() - new Date(date).getTime();
    return [
      Math.floor(diffMs / 60_000),
      Math.floor(diffMs / 3_600_000),
      Math.floor(diffMs / 86_400_000),
    ];
  })();

  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return new Date(date).toLocaleDateString();
}

export function buildSessionOptions(sessions: Session[]): SessionOption[] {
  return sessions.map((session) => {
    let description = session.repos.map((repo) => repo.name).join(" | ");
    const time = formatTimeAgo(session.lastAccessed);

    if (session.goal) {
      const truncatedGoal =
        session.goal.length > 60
          ? `${session.goal.slice(0, 60)}...`
          : session.goal;
      description += `\n  "${truncatedGoal}"`;
    }

    return {
      description,
      name: `${session.name} (${time})`,
      value: session,
    };
  });
}
