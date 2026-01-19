// ============================================
// LLM Response Caching Service
// ============================================

import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { 
  getCachedResponse, 
  setCachedResponse, 
  getCacheStats,
  clearCache as clearDbCache,
  LLMCacheEntry 
} from '../db/database';

// Cache configuration
const DEFAULT_TTL_HOURS = 24 * 7; // 7 days default
const MAX_PROMPT_PREVIEW_LENGTH = 200;

// Statistics tracking
let cacheHits = 0;
let cacheMisses = 0;

/**
 * Generate a hash for the prompt to use as cache key
 * Uses SHA-256 for consistent, fast hashing
 */
export function hashPrompt(prompt: string, model: string): string {
  const content = `${model}:${prompt}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Normalize prompt for better cache hit rates
 * - Trims whitespace
 * - Normalizes line endings
 * - Removes excessive whitespace
 */
export function normalizePrompt(prompt: string): string {
  return prompt
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\n\s+/g, '\n');
}

/**
 * Check if we have a cached response for this prompt
 */
export function getCached(prompt: string, model: string): string | null {
  const normalizedPrompt = normalizePrompt(prompt);
  const hash = hashPrompt(normalizedPrompt, model);
  
  const entry = getCachedResponse(hash);
  
  if (entry) {
    cacheHits++;
    console.log(`📦 Cache HIT for ${model} (hash: ${hash.substring(0, 8)}...)`);
    return entry.response;
  }
  
  cacheMisses++;
  return null;
}

/**
 * Store a response in the cache
 */
export function setCache(
  prompt: string, 
  model: string, 
  response: string,
  ttlHours: number = DEFAULT_TTL_HOURS
): void {
  const normalizedPrompt = normalizePrompt(prompt);
  const hash = hashPrompt(normalizedPrompt, model);
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);
  
  const entry: LLMCacheEntry = {
    id: uuidv4(),
    prompt_hash: hash,
    model,
    prompt_preview: normalizedPrompt.substring(0, MAX_PROMPT_PREVIEW_LENGTH),
    response,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    hit_count: 0,
  };
  
  setCachedResponse(entry);
  console.log(`💾 Cached response for ${model} (hash: ${hash.substring(0, 8)}..., TTL: ${ttlHours}h)`);
}

/**
 * Generate with caching wrapper
 * Returns cached response if available, otherwise generates new one
 */
export async function generateWithCache<T>(
  prompt: string,
  model: string,
  generator: () => Promise<T>,
  options: {
    ttlHours?: number;
    skipCache?: boolean;
    cacheKey?: string; // Optional custom cache key
  } = {}
): Promise<{ result: T; fromCache: boolean }> {
  const { ttlHours = DEFAULT_TTL_HOURS, skipCache = false, cacheKey } = options;
  
  // Check cache unless skipped
  if (!skipCache) {
    const cachedResponse = getCached(cacheKey || prompt, model);
    if (cachedResponse) {
      try {
        // Try to parse if it looks like JSON
        if (cachedResponse.trim().startsWith('[') || cachedResponse.trim().startsWith('{')) {
          return { result: JSON.parse(cachedResponse) as T, fromCache: true };
        }
        return { result: cachedResponse as unknown as T, fromCache: true };
      } catch {
        return { result: cachedResponse as unknown as T, fromCache: true };
      }
    }
  }
  
  // Generate new response
  const result = await generator();
  
  // Cache the result
  const responseString = typeof result === 'string' ? result : JSON.stringify(result);
  setCache(cacheKey || prompt, model, responseString, ttlHours);
  
  return { result, fromCache: false };
}

/**
 * Get cache statistics
 */
export function getStatistics(): {
  sessionHits: number;
  sessionMisses: number;
  hitRate: string;
  dbStats: { total: number; totalHits: number };
} {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) : '0.0';
  
  return {
    sessionHits: cacheHits,
    sessionMisses: cacheMisses,
    hitRate: `${hitRate}%`,
    dbStats: getCacheStats(),
  };
}

/**
 * Clear all cached responses
 */
export function clearAllCache(): number {
  cacheHits = 0;
  cacheMisses = 0;
  return clearDbCache();
}

/**
 * Reset session statistics
 */
export function resetSessionStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Generate a semantic cache key for PRD content
 * Extracts key features to improve cache hit rate for similar PRDs
 */
export function generatePrdCacheKey(prdContent: string): string {
  // Extract key sections/keywords for better matching
  const lines = prdContent.toLowerCase().split('\n');
  const keywords = new Set<string>();
  
  // Extract headers and key terms
  for (const line of lines) {
    // Headers
    if (line.startsWith('#')) {
      keywords.add(line.replace(/^#+\s*/, '').trim());
    }
    // API endpoints
    const apiMatch = line.match(/(?:get|post|put|delete|patch)\s+\/[\w\/-]+/i);
    if (apiMatch) {
      keywords.add(apiMatch[0].toLowerCase());
    }
    // Key terms
    const terms = ['authentication', 'registration', 'login', 'payment', 'checkout', 
                   'cart', 'order', 'user', 'product', 'search', 'filter', 'api'];
    for (const term of terms) {
      if (line.includes(term)) {
        keywords.add(term);
      }
    }
  }
  
  // Create sorted keyword string for consistent hashing
  const keywordString = Array.from(keywords).sort().join('|');
  
  // Combine with content length for uniqueness
  return `prd:${prdContent.length}:${keywordString}`;
}
