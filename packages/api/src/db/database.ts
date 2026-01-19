// ============================================
// Database Abstraction Layer
// Supports SQLite persistence with in-memory fallback
// ============================================

let useSqlite = true;
let sqliteDb: typeof import('./sqlite') | null = null;

// Try to load SQLite module
try {
  sqliteDb = require('./sqlite');
} catch (e) {
  console.log('⚠️  SQLite not available, using in-memory storage');
  useSqlite = false;
}

// ============================================
// In-Memory Fallback Storage
// ============================================

interface PRD {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Scenario {
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

interface LLMCacheEntry {
  id: string;
  prompt_hash: string;
  model: string;
  prompt_preview: string;
  response: string;
  created_at: string;
  expires_at: string | null;
  hit_count: number;
}

interface TestRun {
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

interface GitCommit {
  id: string;
  prd_id: string | null;
  commit_hash: string | null;
  branch: string | null;
  files_added: string;
  message: string | null;
  status: string;
  created_at: string;
}

// In-memory storage
const memoryStore = {
  prds: new Map<string, PRD>(),
  scenarios: new Map<string, Scenario>(),
  cache: new Map<string, LLMCacheEntry>(),
  testRuns: new Map<string, TestRun>(),
  gitCommits: new Map<string, GitCommit>(),
};

// ============================================
// Initialization
// ============================================

export function initDatabase(): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.initDatabase();
  } else {
    console.log('✅ In-memory database initialized');
  }
}

export function getDatabaseType(): 'sqlite' | 'memory' {
  return useSqlite ? 'sqlite' : 'memory';
}

// ============================================
// PRD Operations
// ============================================

export function getAllPrds(): PRD[] {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getAllPrds();
  }
  return Array.from(memoryStore.prds.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getPrdById(id: string): PRD | undefined {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getPrdById(id);
  }
  return memoryStore.prds.get(id);
}

export function createPrd(prd: PRD): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.createPrd(prd);
  } else {
    memoryStore.prds.set(prd.id, prd);
  }
}

export function updatePrdStatus(id: string, status: string): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.updatePrdStatus(id, status);
  }
  const prd = memoryStore.prds.get(id);
  if (prd) {
    prd.status = status;
    prd.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

export function deletePrd(id: string): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.deletePrd(id);
  }
  // Delete associated scenarios first
  for (const [scenarioId, scenario] of memoryStore.scenarios) {
    if (scenario.prd_id === id) {
      memoryStore.scenarios.delete(scenarioId);
    }
  }
  return memoryStore.prds.delete(id);
}

// ============================================
// Scenario Operations
// ============================================

export function getAllScenarios(filters?: { prdId?: string; status?: string }): Scenario[] {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getAllScenarios(filters);
  }
  
  let scenarios = Array.from(memoryStore.scenarios.values());
  if (filters?.prdId) {
    scenarios = scenarios.filter(s => s.prd_id === filters.prdId);
  }
  if (filters?.status) {
    scenarios = scenarios.filter(s => s.status === filters.status);
  }
  return scenarios.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getScenarioById(id: string): Scenario | undefined {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getScenarioById(id);
  }
  return memoryStore.scenarios.get(id);
}

export function getScenariosByPrdId(prdId: string): Scenario[] {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getScenariosByPrdId(prdId);
  }
  return Array.from(memoryStore.scenarios.values())
    .filter(s => s.prd_id === prdId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createScenario(scenario: Scenario): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.createScenario(scenario);
  } else {
    memoryStore.scenarios.set(scenario.id, scenario);
  }
}

export function updateScenarioStatus(id: string, status: string): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.updateScenarioStatus(id, status);
  }
  const scenario = memoryStore.scenarios.get(id);
  if (scenario) {
    scenario.status = status;
    scenario.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

export function bulkUpdateScenarioStatus(ids: string[], status: string): number {
  if (useSqlite && sqliteDb) {
    return sqliteDb.bulkUpdateScenarioStatus(ids, status);
  }
  let updated = 0;
  for (const id of ids) {
    if (updateScenarioStatus(id, status)) {
      updated++;
    }
  }
  return updated;
}

export function updateScenario(id: string, updates: Partial<Scenario>): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.updateScenario(id, updates);
  }
  const scenario = memoryStore.scenarios.get(id);
  if (scenario) {
    Object.assign(scenario, updates, { updated_at: new Date().toISOString() });
    return true;
  }
  return false;
}

export function deleteScenario(id: string): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.deleteScenario(id);
  }
  return memoryStore.scenarios.delete(id);
}

// ============================================
// LLM Cache Operations
// ============================================

export function getCachedResponse(promptHash: string): LLMCacheEntry | undefined {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getCachedResponse(promptHash);
  }
  const entry = memoryStore.cache.get(promptHash);
  if (entry) {
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      memoryStore.cache.delete(promptHash);
      return undefined;
    }
    entry.hit_count++;
  }
  return entry;
}

export function setCachedResponse(entry: LLMCacheEntry): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.setCachedResponse(entry);
  } else {
    memoryStore.cache.set(entry.prompt_hash, entry);
  }
}

export function getCacheStats(): { total: number; totalHits: number } {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getCacheStats();
  }
  let totalHits = 0;
  for (const entry of memoryStore.cache.values()) {
    totalHits += entry.hit_count;
  }
  return { total: memoryStore.cache.size, totalHits };
}

export function clearCache(): number {
  if (useSqlite && sqliteDb) {
    return sqliteDb.clearCache();
  }
  const count = memoryStore.cache.size;
  memoryStore.cache.clear();
  return count;
}

// ============================================
// Test Run Operations
// ============================================

export function createTestRun(run: Partial<TestRun>): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.createTestRun(run);
  } else {
    memoryStore.testRuns.set(run.id!, run as TestRun);
  }
}

export function completeTestRun(id: string, result: { status: string; output: string; exitCode: number; durationMs: number }): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.completeTestRun(id, result);
  }
  const run = memoryStore.testRuns.get(id);
  if (run) {
    run.status = result.status;
    run.output = result.output;
    run.exit_code = result.exitCode;
    run.duration_ms = result.durationMs;
    run.completed_at = new Date().toISOString();
    return true;
  }
  return false;
}

export function getTestRuns(): TestRun[] {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getTestRuns();
  }
  return Array.from(memoryStore.testRuns.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 100);
}

export function getTestRunById(id: string): TestRun | undefined {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getTestRunById(id);
  }
  return memoryStore.testRuns.get(id);
}

export function getTestRunsByScenario(scenarioId: string): TestRun[] {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getTestRunsByScenario(scenarioId);
  }
  return Array.from(memoryStore.testRuns.values())
    .filter(r => r.scenario_id === scenarioId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============================================
// Git Commit Operations
// ============================================

export function createGitCommitRecord(record: Partial<GitCommit>): void {
  if (useSqlite && sqliteDb) {
    sqliteDb.createGitCommitRecord(record);
  } else {
    memoryStore.gitCommits.set(record.id!, record as GitCommit);
  }
}

export function updateGitCommitRecord(id: string, commitHash: string, status: string): boolean {
  if (useSqlite && sqliteDb) {
    return sqliteDb.updateGitCommitRecord(id, commitHash, status);
  }
  const commit = memoryStore.gitCommits.get(id);
  if (commit) {
    commit.commit_hash = commitHash;
    commit.status = status;
    return true;
  }
  return false;
}

export function getGitCommits(): GitCommit[] {
  if (useSqlite && sqliteDb) {
    return sqliteDb.getGitCommits();
  }
  return Array.from(memoryStore.gitCommits.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);
}

// Re-export types
export type { PRD, Scenario, LLMCacheEntry, TestRun, GitCommit };
