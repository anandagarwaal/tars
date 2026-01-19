import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { prdRouter } from './routes/prd';
import { scenarioRouter } from './routes/scenarios';
import { generateRouter } from './routes/generate';
import { hermeticRouter } from './routes/hermetic';
import { analyzeRouter } from './routes/analyze';
import { testsRouter } from './routes/tests';
import { gitRouter } from './routes/git';
import { telemetryRouter } from './routes/telemetry';
import { initDatabase, getAllPrds, getAllScenarios, getCacheStats, clearCache, getDatabaseType } from './db/database';
import { getCacheStatistics, getConfiguredModels } from './services/ollama';
import { wsService } from './services/websocket';
import { telemetry } from './services/telemetry';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Initialize WebSocket server
wsService.initialize(server);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging + telemetry middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Track API request in telemetry
    telemetry.trackApiRequest(req.method, req.path, res.statusCode, duration);
    
    // Console logging (skip noisy endpoints)
    if (req.path !== '/health' && req.path !== '/api/status' && 
        req.path !== '/api/cache/stats' && req.path !== '/api/telemetry/realtime') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Initialize database
initDatabase();

// Routes
app.use('/api/prd', prdRouter);
app.use('/api/scenarios', scenarioRouter);
app.use('/api/generate', generateRouter);
app.use('/api/hermetic', hermeticRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/tests', testsRouter);
app.use('/api/git', gitRouter);
app.use('/api/telemetry', telemetryRouter);

// Enhanced health check with Ollama, WebSocket, and Telemetry status
app.get('/health', async (req, res) => {
  let ollamaStatus = 'unknown';
  let ollamaModels: string[] = [];
  
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    });
    if (ollamaResponse.ok) {
      const data = await ollamaResponse.json() as any;
      ollamaStatus = 'connected';
      ollamaModels = data.models?.map((m: any) => m.name) || [];
    }
  } catch {
    ollamaStatus = 'disconnected';
  }

  // Get configured models for each task type
  const configuredModels = getConfiguredModels();
  
  res.json({
    status: 'ok',
    service: 'tars-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ollama: {
      status: ollamaStatus,
      url: OLLAMA_URL,
      availableModels: ollamaModels,
      configuredModels: {
        scenario: configuredModels.scenario,
        code: configuredModels.code,
        hermetic: configuredModels.hermetic,
        analysis: configuredModels.analysis,
      },
    },
    websocket: {
      status: 'active',
      clients: wsService.getClientCount(),
      path: '/ws',
    },
    telemetry: {
      enabled: telemetry.isEnabled(),
      ...telemetry.getRealTimeStats(),
    },
  });
});

// Status endpoint with stats
app.get('/api/status', (req, res) => {
  const prds = getAllPrds();
  const scenarios = getAllScenarios();
  const cacheStats = getCacheStats();
  const wsStats = wsService.getStats();
  const realtimeStats = telemetry.getRealTimeStats();
  
  res.json({
    database: getDatabaseType(),
    prds: {
      total: prds.length,
      byStatus: {
        draft: prds.filter(p => p.status === 'draft').length,
        processing: prds.filter(p => p.status === 'processing').length,
        completed: prds.filter(p => p.status === 'completed').length,
      }
    },
    scenarios: {
      total: scenarios.length,
      byStatus: {
        pending: scenarios.filter(s => s.status === 'pending').length,
        approved: scenarios.filter(s => s.status === 'approved').length,
        rejected: scenarios.filter(s => s.status === 'rejected').length,
      }
    },
    cache: {
      entries: cacheStats.total,
      totalHits: cacheStats.totalHits,
      hitRate: realtimeStats.cacheHitRate + '%',
    },
    websocket: {
      clients: wsStats.clients,
      messagesSent: wsStats.messagesSent,
    },
    telemetry: {
      requestsLastMinute: realtimeStats.requestsLastMinute,
      errorsLastMinute: realtimeStats.errorsLastMinute,
      avgLatency: realtimeStats.avgLatency + 'ms',
    },
  });
});

// Cache management endpoints
app.get('/api/cache/stats', (req, res) => {
  const stats = getCacheStatistics();
  res.json(stats);
});

app.delete('/api/cache', (req, res) => {
  const cleared = clearCache();
  res.json({ 
    success: true, 
    cleared,
    message: `Cleared ${cleared} cache entries` 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    availableRoutes: [
      'GET  /health',
      'GET  /api/status',
      'GET  /api/cache/stats',
      'DELETE /api/cache',
      'GET  /api/prd',
      'POST /api/prd',
      'GET  /api/scenarios',
      'POST /api/generate/test-code',
      'POST /api/hermetic/code',
      'POST /api/analyze/for-testing',
      'POST /api/tests/run',
      'POST /api/tests/run-all',
      'GET  /api/tests/runs',
      'POST /api/git/check',
      'POST /api/git/commit-files',
      'POST /api/git/push',
      'GET  /api/telemetry/summary',
      'GET  /api/telemetry/metrics',
      'GET  /api/telemetry/realtime',
      'WS   /ws - WebSocket real-time updates',
    ]
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  res.status(500).json({ 
    error: err.message,
    type: err.name,
  });
});

// Startup
async function startup() {
  // Check Ollama connectivity
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║           TARS - Test Automation & Review System     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    const ollamaResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    if (ollamaResponse.ok) {
      const data = await ollamaResponse.json() as any;
      const models = data.models?.map((m: any) => m.name).join(', ') || 'none';
      console.log(`✅ Ollama connected: ${OLLAMA_URL}`);
      console.log(`   Available models: ${models}`);
    } else {
      console.log(`⚠️  Ollama API returned ${ollamaResponse.status}`);
    }
  } catch {
    console.log(`⚠️  Ollama not available at ${OLLAMA_URL}`);
    console.log('   AI features will use fallback templates');
  }
  
  console.log('');
  
  // Use HTTP server (for WebSocket support) instead of Express directly
  server.listen(PORT, () => {
    console.log(`🚀 API Server: http://localhost:${PORT}`);
    console.log(`📡 WebSocket:  ws://localhost:${PORT}/ws`);
    console.log(`💾 Database:   ${getDatabaseType()}`);
    console.log(`📊 Telemetry:  ${telemetry.isEnabled() ? 'Enabled' : 'Disabled'}`);
    console.log('');
    console.log('📚 Core Endpoints:');
    console.log(`   POST /api/prd          - Upload PRD & generate scenarios`);
    console.log(`   GET  /api/scenarios    - List test scenarios`);
    console.log(`   POST /api/generate     - Generate test code`);
    console.log(`   POST /api/hermetic     - Generate Hermetic code`);
    console.log('');
    console.log('🧪 Test Execution:');
    console.log(`   POST /api/tests/run    - Run a single test file`);
    console.log(`   POST /api/tests/run-all - Run all tests in directory`);
    console.log(`   GET  /api/tests/runs   - Get test run history`);
    console.log('');
    console.log('📦 Git Integration:');
    console.log(`   POST /api/git/check    - Check git repository status`);
    console.log(`   POST /api/git/commit-files - Stage and commit files`);
    console.log(`   POST /api/git/push     - Push changes to remote`);
    console.log('');
    console.log('📡 Real-time & Telemetry:');
    console.log(`   WS   /ws                   - WebSocket for real-time updates`);
    console.log(`   GET  /api/telemetry/summary - Usage summary`);
    console.log(`   GET  /api/telemetry/realtime - Real-time metrics`);
    console.log('');
    console.log('⚡ Cache & Status:');
    console.log(`   GET  /health           - Health check`);
    console.log(`   GET  /api/status       - Dashboard statistics`);
    console.log(`   GET  /api/cache/stats  - LLM cache statistics`);
    console.log('');
  });
}

startup();

export { app, server, wsService, telemetry };
