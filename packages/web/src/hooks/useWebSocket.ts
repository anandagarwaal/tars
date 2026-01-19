'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export type WSMessageType =
  | 'connection'
  | 'prd:processing'
  | 'prd:scenario-generated'
  | 'prd:complete'
  | 'prd:error'
  | 'test:started'
  | 'test:progress'
  | 'test:complete'
  | 'cache:hit'
  | 'system:status';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
  timestamp: string;
  id?: string;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WSMessage | null;
  messages: WSMessage[];
  send: (message: any) => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
  clearMessages: () => void;
}

export function useWebSocket(autoConnect: boolean = true): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('📡 WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);
          setMessages((prev) => [...prev.slice(-99), message]); // Keep last 100 messages
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        console.log('📡 WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    send({ type: 'subscribe', channels });
  }, [send]);

  const unsubscribe = useCallback((channels: string[]) => {
    send({ type: 'unsubscribe', channels });
  }, [send]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastMessage(null);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    messages,
    send,
    subscribe,
    unsubscribe,
    clearMessages,
  };
}

// Hook for specific PRD updates
export function usePrdUpdates(prdId: string | null) {
  const { isConnected, lastMessage, messages, subscribe, unsubscribe } = useWebSocket();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'processing' | 'complete' | 'error'>('idle');
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prdId && isConnected) {
      subscribe([`prd:${prdId}`]);
      return () => unsubscribe([`prd:${prdId}`]);
    }
  }, [prdId, isConnected, subscribe, unsubscribe]);

  useEffect(() => {
    if (!lastMessage || !prdId) return;

    const { type, payload } = lastMessage;
    
    if (payload?.prdId !== prdId) return;

    switch (type) {
      case 'prd:processing':
        setStatus('processing');
        setProgress(payload.progress || 0);
        break;
      case 'prd:scenario-generated':
        setProgress(payload.progress || 0);
        setScenarios((prev) => [...prev, payload.scenario]);
        break;
      case 'prd:complete':
        setStatus('complete');
        setProgress(100);
        break;
      case 'prd:error':
        setStatus('error');
        setError(payload.error);
        break;
    }
  }, [lastMessage, prdId]);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('idle');
    setScenarios([]);
    setError(null);
  }, []);

  return {
    isConnected,
    progress,
    status,
    scenarios,
    error,
    reset,
  };
}
