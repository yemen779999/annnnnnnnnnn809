import { Pool } from "pg";
import fs from "fs";
import path from "path";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  ownerId: string;
  title: string;
  sourceUrl?: string;
  type: "clone" | "prompt";
  designTokens: any;
  assets: any;
  code: string;
  qualityScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  userId?: string;
  action: string;
  metadata?: any;
  timestamp: string;
}

let pgPool: Pool | null = null;
const DATA_DIR = path.join(process.cwd(), ".data");
const FILE_DB_PATH = path.join(DATA_DIR, "db.json");

interface MemoryStore {
  users: UserRecord[];
  projects: ProjectRecord[];
  auditLogs: AuditLogRecord[];
}

function getInitialStore(): MemoryStore {
  return {
    users: [],
    projects: [],
    auditLogs: [],
  };
}

function readLocalStore(): MemoryStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(FILE_DB_PATH)) {
      const initial = getInitialStore();
      fs.writeFileSync(FILE_DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(FILE_DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Database] Error reading local store:", err);
    return getInitialStore();
  }
}

function writeLocalStore(store: MemoryStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FILE_DB_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.error("[Database] Error writing local store:", err);
  }
}

async function initPgTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(64) PRIMARY KEY,
      owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      source_url TEXT,
      type VARCHAR(32) NOT NULL DEFAULT 'clone',
      design_tokens JSONB DEFAULT '{}'::jsonb,
      assets JSONB DEFAULT '{}'::jsonb,
      code TEXT NOT NULL,
      quality_score INT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      action VARCHAR(128) NOT NULL,
      metadata JSONB DEFAULT '{}'::jsonb,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres"));
}

export async function getDbPool(): Promise<Pool | null> {
  if (!isPostgresConfigured()) return null;
  if (!pgPool) {
    try {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL?.includes("sslmode=require")
          ? { rejectUnauthorized: false }
          : false,
      });
      await initPgTables(pgPool);
      console.log("[Database] PostgreSQL connection and schema initialized successfully.");
    } catch (err) {
      console.warn("[Database] Failed to initialize PostgreSQL pool, falling back to local persistent store:", err);
      pgPool = null;
    }
  }
  return pgPool;
}

// ---------------- USER OPERATIONS ----------------

export async function dbGetUserByEmail(email: string): Promise<UserRecord | null> {
  const pool = await getDbPool();
  const normalizedEmail = email.toLowerCase().trim();

  if (pool) {
    try {
      const res = await pool.query(
        "SELECT id, email, password_hash AS \"passwordHash\", name, role, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM users WHERE email = $1 LIMIT 1",
        [normalizedEmail]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error("[Database] PostgreSQL getUserByEmail error:", err);
    }
  }

  const store = readLocalStore();
  const user = store.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  return user || null;
}

export async function dbGetUserById(id: string): Promise<UserRecord | null> {
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query(
        "SELECT id, email, password_hash AS \"passwordHash\", name, role, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM users WHERE id = $1 LIMIT 1",
        [id]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error("[Database] PostgreSQL getUserById error:", err);
    }
  }

  const store = readLocalStore();
  const user = store.users.find((u) => u.id === id);
  return user || null;
}

export async function dbCreateUser(user: UserRecord): Promise<UserRecord> {
  const pool = await getDbPool();
  const normalizedUser: UserRecord = {
    ...user,
    email: user.email.toLowerCase().trim(),
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          normalizedUser.id,
          normalizedUser.email,
          normalizedUser.passwordHash,
          normalizedUser.name,
          normalizedUser.role,
          normalizedUser.createdAt,
          normalizedUser.updatedAt,
        ]
      );
      return normalizedUser;
    } catch (err) {
      console.error("[Database] PostgreSQL createUser error:", err);
    }
  }

  const store = readLocalStore();
  const idx = store.users.findIndex((u) => u.id === normalizedUser.id || u.email === normalizedUser.email);
  if (idx >= 0) {
    store.users[idx] = normalizedUser;
  } else {
    store.users.push(normalizedUser);
  }
  writeLocalStore(store);
  return normalizedUser;
}

export async function dbListUsers(): Promise<Omit<UserRecord, "passwordHash">[]> {
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query(
        "SELECT id, email, name, role, created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM users ORDER BY created_at DESC"
      );
      return res.rows;
    } catch (err) {
      console.error("[Database] PostgreSQL listUsers error:", err);
    }
  }

  const store = readLocalStore();
  return store.users.map(({ passwordHash: _hash, ...rest }) => rest);
}

export async function dbCountUsers(): Promise<number> {
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query("SELECT COUNT(*) FROM users");
      return parseInt(res.rows[0].count, 10);
    } catch (err) {
      console.error("[Database] PostgreSQL countUsers error:", err);
    }
  }
  const store = readLocalStore();
  return store.users.length;
}

// ---------------- PROJECT OPERATIONS ----------------

export async function dbCreateProject(project: ProjectRecord): Promise<ProjectRecord> {
  const pool = await getDbPool();
  if (pool) {
    try {
      await pool.query(
        `INSERT INTO projects (id, owner_id, title, source_url, type, design_tokens, assets, code, quality_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          project.id,
          project.ownerId,
          project.title,
          project.sourceUrl || null,
          project.type,
          JSON.stringify(project.designTokens || {}),
          JSON.stringify(project.assets || {}),
          project.code,
          project.qualityScore || 0,
          project.createdAt,
          project.updatedAt,
        ]
      );
      return project;
    } catch (err) {
      console.error("[Database] PostgreSQL createProject error:", err);
    }
  }

  const store = readLocalStore();
  const idx = store.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    store.projects[idx] = project;
  } else {
    store.projects.push(project);
  }
  writeLocalStore(store);
  return project;
}

export async function dbGetProjectById(id: string): Promise<ProjectRecord | null> {
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT id, owner_id AS "ownerId", title, source_url AS "sourceUrl", type,
                design_tokens AS "designTokens", assets, code, quality_score AS "qualityScore",
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM projects WHERE id = $1 LIMIT 1`,
        [id]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.error("[Database] PostgreSQL getProjectById error:", err);
    }
  }

  const store = readLocalStore();
  return store.projects.find((p) => p.id === id) || null;
}

export async function dbListProjects(ownerId?: string): Promise<ProjectRecord[]> {
  const pool = await getDbPool();
  if (pool) {
    try {
      const query = ownerId
        ? `SELECT id, owner_id AS "ownerId", title, source_url AS "sourceUrl", type,
                  design_tokens AS "designTokens", assets, code, quality_score AS "qualityScore",
                  created_at AS "createdAt", updated_at AS "updatedAt"
           FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC`
        : `SELECT id, owner_id AS "ownerId", title, source_url AS "sourceUrl", type,
                  design_tokens AS "designTokens", assets, code, quality_score AS "qualityScore",
                  created_at AS "createdAt", updated_at AS "updatedAt"
           FROM projects ORDER BY updated_at DESC`;
      const params = ownerId ? [ownerId] : [];
      const res = await pool.query(query, params);
      return res.rows;
    } catch (err) {
      console.error("[Database] PostgreSQL listProjects error:", err);
    }
  }

  const store = readLocalStore();
  if (ownerId) {
    return store.projects.filter((p) => p.ownerId === ownerId);
  }
  return store.projects;
}

export async function dbUpdateProject(id: string, updates: Partial<ProjectRecord>): Promise<ProjectRecord | null> {
  const pool = await getDbPool();
  const existing = await dbGetProjectById(id);
  if (!existing) return null;

  const merged: ProjectRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (pool) {
    try {
      await pool.query(
        `UPDATE projects
         SET title = $1, code = $2, design_tokens = $3, assets = $4, quality_score = $5, updated_at = $6
         WHERE id = $7`,
        [
          merged.title,
          merged.code,
          JSON.stringify(merged.designTokens || {}),
          JSON.stringify(merged.assets || {}),
          merged.qualityScore,
          merged.updatedAt,
          id,
        ]
      );
      return merged;
    } catch (err) {
      console.error("[Database] PostgreSQL updateProject error:", err);
    }
  }

  const store = readLocalStore();
  const idx = store.projects.findIndex((p) => p.id === id);
  if (idx >= 0) {
    store.projects[idx] = merged;
    writeLocalStore(store);
  }
  return merged;
}

export async function dbDeleteProject(id: string): Promise<boolean> {
  const pool = await getDbPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM projects WHERE id = $1", [id]);
      return true;
    } catch (err) {
      console.error("[Database] PostgreSQL deleteProject error:", err);
    }
  }

  const store = readLocalStore();
  const initialLen = store.projects.length;
  store.projects = store.projects.filter((p) => p.id !== id);
  writeLocalStore(store);
  return store.projects.length < initialLen;
}

// ---------------- AUDIT LOGS ----------------

export async function dbLogAction(action: string, userId?: string, metadata?: any) {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const timestamp = new Date().toISOString();
  const pool = await getDbPool();

  if (pool) {
    try {
      await pool.query(
        "INSERT INTO audit_logs (id, user_id, action, metadata, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [id, userId || null, action, JSON.stringify(metadata || {}), timestamp]
      );
      return;
    } catch (err) {
      console.error("[Database] PostgreSQL logAction error:", err);
    }
  }

  const store = readLocalStore();
  store.auditLogs.unshift({ id, userId, action, metadata, timestamp });
  if (store.auditLogs.length > 200) {
    store.auditLogs = store.auditLogs.slice(0, 200);
  }
  writeLocalStore(store);
}

export async function dbGetRecentLogs(limit = 20): Promise<AuditLogRecord[]> {
  const pool = await getDbPool();
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT id, user_id AS "userId", action, metadata, timestamp
         FROM audit_logs ORDER BY timestamp DESC LIMIT $1`,
        [limit]
      );
      return res.rows;
    } catch (err) {
      console.error("[Database] PostgreSQL getRecentLogs error:", err);
    }
  }

  const store = readLocalStore();
  return store.auditLogs.slice(0, limit);
}
