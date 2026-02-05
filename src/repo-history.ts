import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { RepoSpec } from "./types";

const DATA_DIR = join(homedir(), ".letmecook");
const DB_PATH = join(DATA_DIR, "history.sqlite");

let db: Database | null = null;

export interface RepoHistoryItem {
  spec: string;
  owner: string;
  name: string;
  branch: string | null;
  lastUsed: string;
  timesUsed: number;
}

async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }

  await mkdir(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH, { create: true });
  db.exec(`
    create table if not exists repo_history (
      spec text primary key,
      owner text not null,
      name text not null,
      branch text,
      last_used text not null,
      times_used integer not null default 1
    );
  `);
  db.exec(
    "create index if not exists idx_repo_history_last_used on repo_history(last_used);"
  );

  return db;
}

export async function listRepoHistory(limit = 50): Promise<RepoHistoryItem[]> {
  const database = await getDb();
  const stmt = database.prepare(`
    select
      spec,
      owner,
      name,
      branch,
      last_used as lastUsed,
      times_used as timesUsed
    from repo_history
    order by last_used desc
    limit ?
  `);

  return stmt.all(limit) as RepoHistoryItem[];
}

export async function recordRepoHistory(repos: RepoSpec[]): Promise<void> {
  if (repos.length === 0) {
    return;
  }

  const database = await getDb();
  const now = new Date().toISOString();
  const stmt = database.prepare(`
    insert into repo_history (spec, owner, name, branch, last_used, times_used)
    values (?, ?, ?, ?, ?, 1)
    on conflict(spec) do update set
      owner = excluded.owner,
      name = excluded.name,
      branch = excluded.branch,
      last_used = excluded.last_used,
      times_used = times_used + 1
  `);

  const insertMany = database.transaction((items: RepoSpec[]) => {
    for (const repo of items) {
      stmt.run(repo.spec, repo.owner, repo.name, repo.branch ?? null, now);
    }
  });

  insertMany(repos);
}
