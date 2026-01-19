// ============================================
// Telemetry Service for Usage Metrics
// ============================================

import { v4 as uuidv4 } from 'uuid';

// Event types
export type TelemetryEventType =
  | 'prd.upload'
  | 'prd.delete'
  | 'scenario.generate'
  | 'scenario.approve'
  | 'scenario.reject'
  | 'test.generate'
  | 'test.execute'
  | 'hermetic.onboard'
  | 'cache.hit'
  | 'cache.miss'
  | 'api.request'
  | 'api.error'
  | 'ws.connect'
  | 'ws.disconnect';

// Event data
interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  timestamp: string;
  duration?: number;
  metadata?: Record<string, any>;
  success?: boolean;
  error?: string;
}

// Aggregated metrics
interface AggregatedMetrics {
  period: 'hour' | 'day' | 'all';
  startTime: string;
  endTime: string;
  counts: Record<TelemetryEventType, number>;
  durations: Record<string, { total: number; count: number; avg: number }>;
  errors: number;
  successRate: number;
}

// In-memory storage (would be database in production)
interface TelemetryStore {
  events: TelemetryEvent[];
  hourlyMetrics: Map<string, AggregatedMetrics>;
  dailyMetrics: Map<string, AggregatedMetrics>;
  sessionStart: Date;
  totalEvents: number;
}

class TelemetryService {
  private store: TelemetryStore = {
    events: [],
    hourlyMetrics: new Map(),
    dailyMetrics: new Map(),
    sessionStart: new Date(),
    totalEvents: 0,
  };

  private readonly maxEventsInMemory = 10000;
  private readonly enabled: boolean;

  constructor() {
    // Check if telemetry is enabled (default: true)
    this.enabled = process.env.TARS_TELEMETRY_ENABLED !== 'false';
    
    if (this.enabled) {
      console.log('📊 Telemetry service initialized');
      // Aggregate metrics every minute
      setInterval(() => this.aggregateMetrics(), 60000);
    }
  }

  /**
   * Track an event
   */
  track(
    type: TelemetryEventType,
    metadata?: Record<string, any>,
    options?: { duration?: number; success?: boolean; error?: string }
  ): string {
    if (!this.enabled) return '';

    const event: TelemetryEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      metadata,
      duration: options?.duration,
      success: options?.success ?? true,
      error: options?.error,
    };

    this.store.events.push(event);
    this.store.totalEvents++;

    // Trim old events if needed
    if (this.store.events.length > this.maxEventsInMemory) {
      this.store.events = this.store.events.slice(-this.maxEventsInMemory / 2);
    }

    return event.id;
  }

  /**
   * Track API request
   */
  trackApiRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.track('api.request', {
      method,
      path,
      statusCode,
    }, {
      duration: durationMs,
      success: statusCode < 400,
    });
  }

  /**
   * Track PRD upload
   */
  trackPrdUpload(prdId: string, scenarioCount: number, durationMs: number): void {
    this.track('prd.upload', {
      prdId,
      scenarioCount,
    }, {
      duration: durationMs,
      success: true,
    });
  }

  /**
   * Track scenario generation
   */
  trackScenarioGenerate(
    prdId: string,
    framework: string,
    count: number,
    durationMs: number,
    fromCache: boolean
  ): void {
    this.track('scenario.generate', {
      prdId,
      framework,
      count,
      fromCache,
    }, {
      duration: durationMs,
      success: true,
    });
  }

  /**
   * Track test generation
   */
  trackTestGenerate(
    scenarioId: string,
    framework: string,
    durationMs: number,
    success: boolean
  ): void {
    this.track('test.generate', {
      scenarioId,
      framework,
    }, {
      duration: durationMs,
      success,
    });
  }

  /**
   * Track test execution
   */
  trackTestExecute(
    runId: string,
    framework: string,
    passed: number,
    failed: number,
    durationMs: number
  ): void {
    this.track('test.execute', {
      runId,
      framework,
      passed,
      failed,
      total: passed + failed,
    }, {
      duration: durationMs,
      success: failed === 0,
    });
  }

  /**
   * Track cache hit/miss
   */
  trackCache(hit: boolean, type: string): void {
    this.track(hit ? 'cache.hit' : 'cache.miss', { type });
  }

  /**
   * Track error
   */
  trackError(type: TelemetryEventType, error: string, metadata?: Record<string, any>): void {
    this.track(type, metadata, { success: false, error });
    this.track('api.error', { ...metadata, originalType: type, error });
  }

  /**
   * Aggregate metrics
   */
  private aggregateMetrics(): void {
    const now = new Date();
    const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Filter events from the last hour
    const hourAgo = new Date(now.getTime() - 3600000);
    const recentEvents = this.store.events.filter(
      e => new Date(e.timestamp) >= hourAgo
    );

    // Calculate hourly metrics
    const hourlyMetrics = this.calculateMetrics(recentEvents, 'hour', hourAgo, now);
    this.store.hourlyMetrics.set(hourKey, hourlyMetrics);

    // Keep only last 24 hours of hourly metrics
    const keys = Array.from(this.store.hourlyMetrics.keys()).sort();
    while (keys.length > 24) {
      this.store.hourlyMetrics.delete(keys.shift()!);
    }
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetrics(
    events: TelemetryEvent[],
    period: 'hour' | 'day' | 'all',
    startTime: Date,
    endTime: Date
  ): AggregatedMetrics {
    const counts: Record<string, number> = {};
    const durations: Record<string, { total: number; count: number; avg: number }> = {};
    let errors = 0;
    let successCount = 0;

    for (const event of events) {
      // Count by type
      counts[event.type] = (counts[event.type] || 0) + 1;

      // Track durations
      if (event.duration !== undefined) {
        if (!durations[event.type]) {
          durations[event.type] = { total: 0, count: 0, avg: 0 };
        }
        durations[event.type].total += event.duration;
        durations[event.type].count++;
        durations[event.type].avg = durations[event.type].total / durations[event.type].count;
      }

      // Track success/errors
      if (event.success === false) {
        errors++;
      } else {
        successCount++;
      }
    }

    const total = events.length;
    const successRate = total > 0 ? (successCount / total) * 100 : 100;

    return {
      period,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      counts: counts as Record<TelemetryEventType, number>,
      durations,
      errors,
      successRate: Math.round(successRate * 100) / 100,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(period: 'hour' | 'day' | 'all' = 'hour'): AggregatedMetrics {
    const now = new Date();
    let startTime: Date;
    let events: TelemetryEvent[];

    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 3600000);
        events = this.store.events.filter(e => new Date(e.timestamp) >= startTime);
        break;
      case 'day':
        startTime = new Date(now.getTime() - 86400000);
        events = this.store.events.filter(e => new Date(e.timestamp) >= startTime);
        break;
      case 'all':
        startTime = this.store.sessionStart;
        events = this.store.events;
        break;
    }

    return this.calculateMetrics(events, period, startTime, now);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    sessionDuration: string;
    totalEvents: number;
    eventsPerMinute: number;
    topEventTypes: { type: string; count: number }[];
    recentErrors: TelemetryEvent[];
    avgResponseTime: number;
  } {
    const sessionMs = Date.now() - this.store.sessionStart.getTime();
    const sessionMinutes = sessionMs / 60000;

    // Count event types
    const typeCounts: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const event of this.store.events) {
      typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
      if (event.duration) {
        totalDuration += event.duration;
        durationCount++;
      }
    }

    // Sort by count
    const topEventTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent errors
    const recentErrors = this.store.events
      .filter(e => e.success === false)
      .slice(-10);

    return {
      sessionDuration: formatDuration(sessionMs),
      totalEvents: this.store.totalEvents,
      eventsPerMinute: Math.round((this.store.totalEvents / sessionMinutes) * 100) / 100,
      topEventTypes,
      recentErrors,
      avgResponseTime: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    };
  }

  /**
   * Get real-time stats for dashboard
   */
  getRealTimeStats(): {
    activeConnections: number;
    requestsLastMinute: number;
    errorsLastMinute: number;
    cacheHitRate: number;
    avgLatency: number;
  } {
    const minuteAgo = new Date(Date.now() - 60000);
    const recentEvents = this.store.events.filter(
      e => new Date(e.timestamp) >= minuteAgo
    );

    const requests = recentEvents.filter(e => e.type === 'api.request').length;
    const errors = recentEvents.filter(e => e.success === false).length;
    
    const cacheHits = recentEvents.filter(e => e.type === 'cache.hit').length;
    const cacheMisses = recentEvents.filter(e => e.type === 'cache.miss').length;
    const cacheTotal = cacheHits + cacheMisses;
    
    const latencies = recentEvents
      .filter(e => e.duration !== undefined)
      .map(e => e.duration!);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    return {
      activeConnections: 0, // Will be set by WebSocket service
      requestsLastMinute: requests,
      errorsLastMinute: errors,
      cacheHitRate: cacheTotal > 0 ? Math.round((cacheHits / cacheTotal) * 100) : 0,
      avgLatency: Math.round(avgLatency),
    };
  }

  /**
   * Export metrics for external systems
   */
  exportMetrics(): {
    timestamp: string;
    session: { start: string; duration: string };
    summary: ReturnType<TelemetryService['getSummary']>;
    hourly: AggregatedMetrics;
    daily: AggregatedMetrics;
  } {
    return {
      timestamp: new Date().toISOString(),
      session: {
        start: this.store.sessionStart.toISOString(),
        duration: formatDuration(Date.now() - this.store.sessionStart.getTime()),
      },
      summary: this.getSummary(),
      hourly: this.getMetrics('hour'),
      daily: this.getMetrics('day'),
    };
  }

  /**
   * Reset telemetry (for testing)
   */
  reset(): void {
    this.store = {
      events: [],
      hourlyMetrics: new Map(),
      dailyMetrics: new Map(),
      sessionStart: new Date(),
      totalEvents: 0,
    };
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Helper function
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Singleton instance
export const telemetry = new TelemetryService();
