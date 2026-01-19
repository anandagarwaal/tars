'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Activity, 
  Zap, 
  AlertTriangle, 
  Clock, 
  Users,
  TrendingUp,
  Server,
  RefreshCw
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RealTimeStats {
  activeConnections: number;
  requestsLastMinute: number;
  errorsLastMinute: number;
  cacheHitRate: number;
  avgLatency: number;
}

interface TelemetrySummary {
  sessionDuration: string;
  totalEvents: number;
  eventsPerMinute: number;
  topEventTypes: { type: string; count: number }[];
  recentErrors: any[];
  avgResponseTime: number;
}

export function TelemetryDashboard() {
  const [realTimeStats, setRealTimeStats] = useState<RealTimeStats | null>(null);
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTelemetry = async () => {
    try {
      const [realtimeRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/telemetry/realtime`),
        fetch(`${API_URL}/api/telemetry/summary`),
      ]);

      if (realtimeRes.ok) {
        setRealTimeStats(await realtimeRes.json());
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch telemetry:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    
    if (autoRefresh) {
      const interval = setInterval(fetchTelemetry, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Telemetry Dashboard</h2>
            <p className="text-slate-500 text-sm">Real-time system metrics and performance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              autoRefresh
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={fetchTelemetry}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 hover:text-slate-900 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-time Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="WebSocket Clients"
          value={realTimeStats?.activeConnections ?? 0}
          color="indigo"
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Requests/min"
          value={realTimeStats?.requestsLastMinute ?? 0}
          color="blue"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Errors/min"
          value={realTimeStats?.errorsLastMinute ?? 0}
          color={realTimeStats?.errorsLastMinute && realTimeStats.errorsLastMinute > 0 ? 'rose' : 'emerald'}
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="Cache Hit Rate"
          value={`${realTimeStats?.cacheHitRate ?? 0}%`}
          color="amber"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Latency"
          value={`${realTimeStats?.avgLatency ?? 0}ms`}
          color="violet"
        />
      </div>

      {/* Summary Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Session Info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Server className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Session Info</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-600">Session Duration</span>
              <span className="text-slate-900 font-semibold">{summary?.sessionDuration ?? '-'}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-600">Total Events</span>
              <span className="text-slate-900 font-semibold">{summary?.totalEvents?.toLocaleString() ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-600">Events/min</span>
              <span className="text-slate-900 font-semibold">{summary?.eventsPerMinute?.toFixed(1) ?? 0}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-slate-600">Avg Response Time</span>
              <span className="text-slate-900 font-semibold">{summary?.avgResponseTime ?? 0}ms</span>
            </div>
          </div>
        </div>

        {/* Top Events */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Top Event Types</h3>
          </div>
          <div className="space-y-4">
            {summary?.topEventTypes?.length ? (
              summary.topEventTypes.map((event, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-slate-700">{event.type}</span>
                    <span className="text-sm text-slate-500">{event.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                      style={{
                        width: `${(event.count / (summary.topEventTypes[0]?.count || 1)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm py-4 text-center">No events recorded yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {summary?.recentErrors && summary.recentErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="text-lg font-bold text-rose-900">Recent Errors</h3>
          </div>
          <div className="space-y-3">
            {summary.recentErrors.slice(-5).map((error, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-rose-100">
                <span className="text-rose-500 text-xs font-mono whitespace-nowrap">
                  {new Date(error.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-rose-700 text-sm">{error.type}: {error.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';
}) {
  const colorClasses = {
    indigo: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      icon: 'text-indigo-600',
      value: 'text-indigo-700',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: 'text-blue-600',
      value: 'text-blue-700',
    },
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      icon: 'text-emerald-600',
      value: 'text-emerald-700',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: 'text-amber-600',
      value: 'text-amber-700',
    },
    rose: {
      bg: 'bg-rose-50',
      border: 'border-rose-100',
      icon: 'text-rose-600',
      value: 'text-rose-700',
    },
    violet: {
      bg: 'bg-violet-50',
      border: 'border-violet-100',
      icon: 'text-violet-600',
      value: 'text-violet-700',
    },
  };

  const classes = colorClasses[color];

  return (
    <div className={`p-5 rounded-xl border ${classes.bg} ${classes.border}`}>
      <div className={`${classes.icon} mb-3`}>{icon}</div>
      <div className={`text-2xl font-bold ${classes.value}`}>{value}</div>
      <div className="text-xs text-slate-500 font-medium mt-1">{label}</div>
    </div>
  );
}
