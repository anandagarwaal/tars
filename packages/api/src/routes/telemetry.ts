// ============================================
// Telemetry Routes
// ============================================

import { Router, Request, Response } from 'express';
import { telemetry } from '../services/telemetry';
import { wsService } from '../services/websocket';

export const telemetryRouter = Router();

/**
 * Get telemetry summary
 * GET /api/telemetry/summary
 */
telemetryRouter.get('/summary', (req: Request, res: Response) => {
  try {
    const summary = telemetry.getSummary();
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get metrics for a period
 * GET /api/telemetry/metrics?period=hour|day|all
 */
telemetryRouter.get('/metrics', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as 'hour' | 'day' | 'all') || 'hour';
    const metrics = telemetry.getMetrics(period);
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get real-time stats
 * GET /api/telemetry/realtime
 */
telemetryRouter.get('/realtime', (req: Request, res: Response) => {
  try {
    const stats = telemetry.getRealTimeStats();
    // Add WebSocket connection count
    stats.activeConnections = wsService.getClientCount();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export full telemetry data
 * GET /api/telemetry/export
 */
telemetryRouter.get('/export', (req: Request, res: Response) => {
  try {
    const data = telemetry.exportMetrics();
    
    // Add WebSocket stats
    const wsStats = wsService.getStats();
    
    res.json({
      ...data,
      websocket: wsStats,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get telemetry status
 * GET /api/telemetry/status
 */
telemetryRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    enabled: telemetry.isEnabled(),
    websocket: {
      clients: wsService.getClientCount(),
      ...wsService.getStats(),
    },
  });
});

/**
 * Reset telemetry (dev only)
 * POST /api/telemetry/reset
 */
telemetryRouter.post('/reset', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not allowed in production' });
  }
  
  telemetry.reset();
  res.json({ success: true, message: 'Telemetry reset' });
});
