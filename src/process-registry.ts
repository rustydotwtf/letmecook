import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DATA_DIR = join(homedir(), ".letmecook");
const DB_PATH = join(DATA_DIR, "history.sqlite");

let db: Database | null = null;

export interface BackgroundProcess {
  pid: number;
  command: string;
  description: string;
  sessionName: string;
  startTime: string;
}

interface DbRow {
  pid: number;
  command: string;
  description: string;
  session_name: string;
  start_time: string;
}

async function getDb(): Promise<Database> {
  if (db) {
    return db;
  }

  await mkdir(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH, { create: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS background_processes (
      pid INTEGER PRIMARY KEY,
      command TEXT NOT NULL,
      description TEXT NOT NULL,
      session_name TEXT NOT NULL,
      start_time TEXT NOT NULL
    );
  `);

  return db;
}

function rowToProcess(row: DbRow): BackgroundProcess {
  return {
    command: row.command,
    description: row.description,
    pid: row.pid,
    sessionName: row.session_name,
    startTime: row.start_time,
  };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function registerBackgroundProcess(
  pid: number,
  command: string,
  description: string,
  sessionName: string
): Promise<void> {
  const database = await getDb();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO background_processes
    (pid, command, description, session_name, start_time)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(pid, command, description, sessionName, new Date().toISOString());
}

export async function getRunningProcesses(): Promise<BackgroundProcess[]> {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM background_processes`);
  const rows = stmt.all() as DbRow[];

  const aliveProcesses: BackgroundProcess[] = [];
  const deadPids: number[] = [];

  for (const row of rows) {
    if (isProcessAlive(row.pid)) {
      aliveProcesses.push(rowToProcess(row));
    } else {
      deadPids.push(row.pid);
    }
  }

  // Clean up dead processes from the database
  if (deadPids.length > 0) {
    const deleteStmt = database.prepare(
      `DELETE FROM background_processes WHERE pid = ?`
    );
    const deleteMany = database.transaction((pids: number[]) => {
      for (const pid of pids) {
        deleteStmt.run(pid);
      }
    });
    deleteMany(deadPids);
  }

  return aliveProcesses;
}

export async function getProcessesForSession(
  sessionName: string
): Promise<BackgroundProcess[]> {
  const database = await getDb();
  const stmt = database.prepare(
    `SELECT * FROM background_processes WHERE session_name = ?`
  );
  const rows = stmt.all(sessionName) as DbRow[];

  const aliveProcesses: BackgroundProcess[] = [];
  const deadPids: number[] = [];

  for (const row of rows) {
    if (isProcessAlive(row.pid)) {
      aliveProcesses.push(rowToProcess(row));
    } else {
      deadPids.push(row.pid);
    }
  }

  // Clean up dead processes from the database
  if (deadPids.length > 0) {
    const deleteStmt = database.prepare(
      `DELETE FROM background_processes WHERE pid = ?`
    );
    const deleteMany = database.transaction((pids: number[]) => {
      for (const pid of pids) {
        deleteStmt.run(pid);
      }
    });
    deleteMany(deadPids);
  }

  return aliveProcesses;
}

export async function killProcess(pid: number): Promise<boolean> {
  try {
    // First try SIGTERM for graceful shutdown
    process.kill(pid, "SIGTERM");

    // Wait up to 3 seconds for process to exit
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      await Bun.sleep(100);
      if (!isProcessAlive(pid)) {
        await removeProcessFromRegistry(pid);
        return true;
      }
    }

    // Process didn't exit, send SIGKILL
    process.kill(pid, "SIGKILL");
    await Bun.sleep(100);

    await removeProcessFromRegistry(pid);
    return true;
  } catch {
    // Process may have already exited
    await removeProcessFromRegistry(pid);
    return false;
  }
}

export async function killAllProcesses(): Promise<void> {
  const runningProcesses = await getRunningProcesses();

  for (const proc of runningProcesses) {
    await killProcess(proc.pid);
  }
}

async function removeProcessFromRegistry(pid: number): Promise<void> {
  const database = await getDb();
  const stmt = database.prepare(
    `DELETE FROM background_processes WHERE pid = ?`
  );
  stmt.run(pid);
}
