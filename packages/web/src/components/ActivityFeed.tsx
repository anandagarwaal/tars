'use client';

import { useState, useEffect } from 'react';
import { useWebSocket, WSMessage } from '../hooks/useWebSocket';
import { Activity, FileText, TestTube, CheckCircle, XCircle, Zap, Wifi, WifiOff } from 'lucide-react';

const getMessageIcon = (type: string) => {
  switch (type) {
    case 'prd:processing':
      return <FileText className="w-4 h-4 text-indigo-600" />;
    case 'prd:scenario-generated':
      return <TestTube className="w-4 h-4 text-violet-600" />;
    case 'prd:complete':
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    case 'prd:error':
      return <XCircle className="w-4 h-4 text-rose-600" />;
    case 'cache:hit':
      return <Zap className="w-4 h-4 text-amber-600" />;
    default:
      return <Activity className="w-4 h-4 text-slate-500" />;
  }
};

const getMessageText = (msg: WSMessage): string => {
  switch (msg.type) {
    case 'connection':
      return 'Connected to TARS';
    case 'prd:processing':
      return `Processing PRD: "${msg.payload.title}"`;
    case 'prd:scenario-generated':
      return `Generated: ${msg.payload.scenario?.title} (${msg.payload.current}/${msg.payload.total})`;
    case 'prd:complete':
      return `PRD complete: ${msg.payload.scenarioCount} scenarios generated`;
    case 'prd:error':
      return `Error: ${msg.payload.error}`;
    case 'cache:hit':
      return `Cache hit: ${msg.payload.type}`;
    case 'test:started':
      return `Test started: ${msg.payload.testFile}`;
    case 'test:complete':
      return `Test complete: ${msg.payload.status}`;
    default:
      return msg.type;
  }
};

const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  });
};

export function ActivityFeed() {
  const { isConnected, messages, clearMessages } = useWebSocket();
  const [expanded, setExpanded] = useState(false);

  // Filter to show only relevant messages
  const displayMessages = messages
    .filter(m => m.type !== 'connection' && m.type !== 'system:status')
    .slice(-10)
    .reverse();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Activity className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-sm font-semibold text-slate-900">Live Activity</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>
          
          {/* Clear button */}
          {displayMessages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Clear
            </button>
          )}
          
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={`overflow-y-auto transition-all ${expanded ? 'max-h-96' : 'max-h-48'}`}>
        {displayMessages.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
            <Activity className="w-5 h-5 mr-2 animate-pulse" />
            Waiting for activity...
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayMessages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors animate-fadeIn"
              >
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {getMessageIcon(msg.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 font-medium">
                    {getMessageText(msg)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
                
                {/* Progress indicator for PRD processing */}
                {msg.type === 'prd:scenario-generated' && msg.payload.progress !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                        style={{ width: `${msg.payload.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-indigo-600 font-medium">{msg.payload.progress}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Mini version for the header
export function ActivityIndicator() {
  const { isConnected, lastMessage } = useWebSocket();
  const [showPulse, setShowPulse] = useState(false);

  useEffect(() => {
    if (lastMessage) {
      setShowPulse(true);
      const timeout = setTimeout(() => setShowPulse(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [lastMessage]);

  if (!isConnected) return null;

  return (
    <div className={`w-2 h-2 rounded-full bg-indigo-600 ${showPulse ? 'animate-ping' : ''}`} />
  );
}
