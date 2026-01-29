import  { type Session } from "../types";

export interface SessionOption {
  name: string;
  description: string;
  value: Session;
}

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {return "just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  if (diffHours < 24) {return `${diffHours}h ago`;}
  if (diffDays < 7) {return `${diffDays}d ago`;}
  return then.toLocaleDateString();
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
