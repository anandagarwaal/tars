// ============================================
// SQLite Database with Persistence
// ============================================

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// Database file location
const DB_DIR = process.env.TARS_DATA_DIR || path.join(process.cwd(), '.tars');
const DB_PATH = path.join(DB_DIR, 'tars.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // Better concurrent access

// ============================================
// Schema Definition
// ============================================

const schema = `
  -- PRDs table
  CREATE TABLE IF NOT EXISTS prds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Scenarios table
  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    prd_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'integration',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    steps TEXT DEFAULT '[]',
    test_data TEXT DEFAULT '{}',
    tags TEXT DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (prd_id) REFERENCES prds(id) ON DELETE CASCADE
  );

  -- LLM Cache table
  CREATE TABLE IF NOT EXISTS llm_cache (
    id TEXT PRIMARY KEY,
    prompt_hash TEXT UNIQUE NOT NULL,
    model TEXT NOT NULL,
    prompt_preview TEXT,
    response TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    hit_count INTEGER DEFAULT 0
  );

  -- Test Runs table
  CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    scenario_id TEXT,
    prd_id TEXT,
    framework TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    output TEXT,
    exit_code INTEGER,
    duration_ms INTEGER,
    test_file TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );

  -- Git Commits table
  CREATE TABLE IF NOT EXISTS git_commits (
    id TEXT PRIMARY KEY,
    prd_id TEXT,
    commit_hash TEXT,
    branch TEXT,
    files_added TEXT DEFAULT '[]',
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_scenarios_prd_id ON scenarios(prd_id);
  CREATE INDEX IF NOT EXISTS idx_scenarios_status ON scenarios(status);
  CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_cache(prompt_hash);
  CREATE INDEX IF NOT EXISTS idx_test_runs_scenario ON test_runs(scenario_id);
`;

// Initialize schema
db.exec(schema);

// ============================================
// PRD Operations
// ============================================

export interface PRD {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const prdStatements = {
  getAll: db.prepare('SELECT * FROM prds ORDER BY created_at DESC'),
  getById: db.prepare('SELECT * FROM prds WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO prds (id, title, content, status, created_at, updated_at)
    VALUES (@id, @title, @content, @status, @created_at, @updated_at)
  `),
  updateStatus: db.prepare('UPDATE prds SET status = ?, updated_at = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM prds WHERE id = ?'),
};

export function getAllPrds(): PRD[] {
  return prdStatements.getAll.all() as PRD[];
}

export function getPrdById(id: string): PRD | undefined {
  return prdStatements.getById.get(id) as PRD | undefined;
}

export function createPrd(prd: PRD): void {
  prdStatements.create.run(prd);
}

export function updatePrdStatus(id: string, status: string): boolean {
  const result = prdStatements.updateStatus.run(status, new Date().toISOString(), id);
  return result.changes > 0;
}

export function deletePrd(id: string): boolean {
  const result = prdStatements.delete.run(id);
  return result.changes > 0;
}

// ============================================
// Scenario Operations
// ============================================

export interface Scenario {
  id: string;
  prd_id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  steps: string;
  test_data: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

const scenarioStatements = {
  getAll: db.prepare('SELECT * FROM scenarios ORDER BY created_at DESC'),
  getByPrdId: db.prepare('SELECT * FROM scenarios WHERE prd_id = ? ORDER BY created_at DESC'),
  getByStatus: db.prepare('SELECT * FROM scenarios WHERE status = ? ORDER BY created_at DESC'),
  getByPrdAndStatus: db.prepare('SELECT * FROM scenarios WHERE prd_id = ? AND status = ? ORDER BY created_at DESC'),
  getById: db.prepare('SELECT * FROM scenarios WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO scenarios (id, prd_id, title, description, type, priority, status, steps, test_data, tags, created_at, updated_at)
    VALUES (@id, @prd_id, @title, @description, @type, @priority, @status, @steps, @test_data, @tags, @created_at, @updated_at)
  `),
  updateStatus: db.prepare('UPDATE scenarios SET status = ?, updated_at = ? WHERE id = ?'),
  update: db.prepare(`
    UPDATE scenarios SET 
      title = COALESCE(@title, title),
      description = COALESCE(@description, description),
      type = COALESCE(@type, type),
      priority = COALESCE(@priority, priority),
      steps = COALESCE(@steps, steps),
      test_data = COALESCE(@test_data, test_data),
      tags = COALESCE(@tags, tags),
      updated_at = @updated_at
    WHERE id = @id
  `),
  delete: db.prepare('DELETE FROM scenarios WHERE id = ?'),
};

export function getAllScenarios(filters?: { prdId?: string; status?: string }): Scenario[] {
  if (filters?.prdId && filters?.status) {
    return scenarioStatements.getByPrdAndStatus.all(filters.prdId, filters.status) as Scenario[];
  }
  if (filters?.prdId) {
    return scenarioStatements.getByPrdId.all(filters.prdId) as Scenario[];
  }
  if (filters?.status) {
    return scenarioStatements.getByStatus.all(filters.status) as Scenario[];
  }
  return scenarioStatements.getAll.all() as Scenario[];
}

export function getScenarioById(id: string): Scenario | undefined {
  return scenarioStatements.getById.get(id) as Scenario | undefined;
}

export function getScenariosByPrdId(prdId: string): Scenario[] {
  return scenarioStatements.getByPrdId.all(prdId) as Scenario[];
}

export function createScenario(scenario: Scenario): void {
  scenarioStatements.create.run(scenario);
}

export function updateScenarioStatus(id: string, status: string): boolean {
  const result = scenarioStatements.updateStatus.run(status, new Date().toISOString(), id);
  return result.changes > 0;
}

export function bulkUpdateScenarioStatus(ids: string[], status: string): number {
  const updateOne = db.prepare('UPDATE scenarios SET status = ?, updated_at = ? WHERE id = ?');
  const updateMany = db.transaction((scenarioIds: string[]) => {
    let count = 0;
    const now = new Date().toISOString();
    for (const id of scenarioIds) {
      const result = updateOne.run(status, now, id);
      count += result.changes;
    }
    return count;
  });
  return updateMany(ids);
}

export function updateScenario(id: string, updates: Partial<Scenario>): boolean {
  const result = scenarioStatements.update.run({
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  });
  return result.changes > 0;
}

export function deleteScenario(id: string): boolean {
  const result = scenarioStatements.delete.run(id);
  return result.changes > 0;
}

// ============================================
// LLM Cache Operations
// ============================================

export interface LLMCacheEntry {
  id: string;
  prompt_hash: string;
  model: string;
  prompt_preview: string;
  response: string;
  created_at: string;
  expires_at: string | null;
  hit_count: number;
}

const cacheStatements = {
  getByHash: db.prepare('SELECT * FROM llm_cache WHERE prompt_hash = ?'),
  create: db.prepare(`
    INSERT INTO llm_cache (id, prompt_hash, model, prompt_preview, response, created_at, expires_at, hit_count)
    VALUES (@id, @prompt_hash, @model, @prompt_preview, @response, @created_at, @expires_at, @hit_count)
  `),
  incrementHit: db.prepare('UPDATE llm_cache SET hit_count = hit_count + 1 WHERE prompt_hash = ?'),
  deleteExpired: db.prepare('DELETE FROM llm_cache WHERE expires_at IS NOT NULL AND expires_at < ?'),
  getStats: db.prepare('SELECT COUNT(*) as total, SUM(hit_count) as total_hits FROM llm_cache'),
  clear: db.prepare('DELETE FROM llm_cache'),
};

export function getCachedResponse(promptHash: string): LLMCacheEntry | undefined {
  const entry = cacheStatements.getByHash.get(promptHash) as LLMCacheEntry | undefined;
  if (entry) {
    // Check if expired
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      return undefined;
    }
    // Increment hit count
    cacheStatements.incrementHit.run(promptHash);
  }
  return entry;
}

export function setCachedResponse(entry: LLMCacheEntry): void {
  try {
    cacheStatements.create.run(entry);
  } catch (e: any) {
    // Handle duplicate key (update instead)
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      cacheStatements.incrementHit.run(entry.prompt_hash);
    } else {
      throw e;
    }
  }
}

export function cleanExpiredCache(): number {
  const result = cacheStatements.deleteExpired.run(new Date().toISOString());
  return result.changes;
}

export function getCacheStats(): { total: number; totalHits: number } {
  const stats = cacheStatements.getStats.get() as any;
  return { total: stats.total || 0, totalHits: stats.total_hits || 0 };
}

export function clearCache(): number {
  const result = cacheStatements.clear.run();
  return result.changes;
}

// ============================================
// Test Run Operations
// ============================================

export interface TestRun {
  id: string;
  scenario_id: string | null;
  prd_id: string | null;
  framework: string;
  status: string;
  output: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  test_file: string | null;
  created_at: string;
  completed_at: string | null;
}

const testRunStatements = {
  getAll: db.prepare('SELECT * FROM test_runs ORDER BY created_at DESC LIMIT 100'),
  getById: db.prepare('SELECT * FROM test_runs WHERE id = ?'),
  getByScenario: db.prepare('SELECT * FROM test_runs WHERE scenario_id = ? ORDER BY created_at DESC'),
  create: db.prepare(`
    INSERT INTO test_runs (id, scenario_id, prd_id, framework, status, test_file, created_at)
    VALUES (@id, @scenario_id, @prd_id, @framework, @status, @test_file, @created_at)
  `),
  complete: db.prepare(`
    UPDATE test_runs 
    SET status = @status, output = @output, exit_code = @exit_code, duration_ms = @duration_ms, completed_at = @completed_at
    WHERE id = @id
  `),
};

export function createTestRun(run: Partial<TestRun>): void {
  testRunStatements.create.run(run);
}

export function completeTestRun(id: string, result: { status: string; output: string; exitCode: number; durationMs: number }): boolean {
  const updateResult = testRunStatements.complete.run({
    id,
    status: result.status,
    output: result.output,
    exit_code: result.exitCode,
    duration_ms: result.durationMs,
    completed_at: new Date().toISOString(),
  });
  return updateResult.changes > 0;
}

export function getTestRuns(): TestRun[] {
  return testRunStatements.getAll.all() as TestRun[];
}

export function getTestRunById(id: string): TestRun | undefined {
  return testRunStatements.getById.get(id) as TestRun | undefined;
}

export function getTestRunsByScenario(scenarioId: string): TestRun[] {
  return testRunStatements.getByScenario.all(scenarioId) as TestRun[];
}

// ============================================
// Git Commit Operations
// ============================================

export interface GitCommit {
  id: string;
  prd_id: string | null;
  commit_hash: string | null;
  branch: string | null;
  files_added: string;
  message: string | null;
  status: string;
  created_at: string;
}

const gitStatements = {
  getAll: db.prepare('SELECT * FROM git_commits ORDER BY created_at DESC LIMIT 50'),
  getById: db.prepare('SELECT * FROM git_commits WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO git_commits (id, prd_id, branch, files_added, message, status, created_at)
    VALUES (@id, @prd_id, @branch, @files_added, @message, @status, @created_at)
  `),
  update: db.prepare(`
    UPDATE git_commits SET commit_hash = @commit_hash, status = @status WHERE id = @id
  `),
};

export function createGitCommitRecord(record: Partial<GitCommit>): void {
  gitStatements.create.run(record);
}

export function updateGitCommitRecord(id: string, commitHash: string, status: string): boolean {
  const result = gitStatements.update.run({ id, commit_hash: commitHash, status });
  return result.changes > 0;
}

export function getGitCommits(): GitCommit[] {
  return gitStatements.getAll.all() as GitCommit[];
}

// ============================================
// Database Utilities
// ============================================

export function initDatabase(): void {
  console.log(`✅ SQLite database initialized at ${DB_PATH}`);
  
  // Clean expired cache on startup
  const expired = cleanExpiredCache();
  if (expired > 0) {
    console.log(`   Cleaned ${expired} expired cache entries`);
  }
  
  // Show stats
  const stats = getCacheStats();
  if (stats.total > 0) {
    console.log(`   LLM Cache: ${stats.total} entries, ${stats.totalHits} hits`);
  }
}

export function getDatabasePath(): string {
  return DB_PATH;
}

export function closeDatabase(): void {
  db.close();
}

// Export raw db for advanced operations
export { db };
