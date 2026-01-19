'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, TestTube, Terminal, Github, Wifi, WifiOff, BarChart3, Zap, Server, Radio } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const navItems = [
  { href: '/', label: 'Upload', icon: Home },
  { href: '/prds', label: 'PRDs', icon: FileText },
  { href: '/scenarios', label: 'Scenarios', icon: TestTube },
  { href: '/hermetic', label: 'Hermetic', icon: Server },
  { href: '/raptor', label: 'Raptor', icon: Radio },
  { href: '/telemetry', label: 'Metrics', icon: BarChart3 },
];

type OllamaStatus = 'checking' | 'connected' | 'disconnected' | 'api-down';

export function Navigation() {
  const pathname = usePathname();
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>('checking');

  useEffect(() => {
    checkOllamaStatus();
    // Check every 30 seconds
    const interval = setInterval(checkOllamaStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkOllamaStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        setOllamaStatus('api-down');
        return;
      }

      const data = await response.json();
      
      if (data.ollama?.status === 'connected') {
        setOllamaStatus('connected');
      } else {
        setOllamaStatus('disconnected');
      }
    } catch {
      setOllamaStatus('api-down');
    }
  };

  const getStatusDisplay = () => {
    switch (ollamaStatus) {
      case 'checking':
        return {
          bgClass: 'bg-slate-100 border-slate-200',
          dotClass: 'bg-slate-400',
          textClass: 'text-slate-500',
          text: 'Checking...',
          Icon: Wifi,
        };
      case 'connected':
        return {
          bgClass: 'bg-emerald-50 border-emerald-200',
          dotClass: 'bg-emerald-500 animate-pulse',
          textClass: 'text-emerald-700',
          text: 'AI Ready',
          Icon: Zap,
        };
      case 'disconnected':
        return {
          bgClass: 'bg-amber-50 border-amber-200',
          dotClass: 'bg-amber-500',
          textClass: 'text-amber-700',
          text: 'Ollama Offline',
          Icon: WifiOff,
        };
      case 'api-down':
        return {
          bgClass: 'bg-rose-50 border-rose-200',
          dotClass: 'bg-rose-500',
          textClass: 'text-rose-700',
          text: 'API Offline',
          Icon: WifiOff,
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/30 group-hover:scale-105 transition-all">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900">
                TARS
              </span>
              <span className="hidden sm:inline text-xs text-slate-400 ml-2 font-medium">
                Test Automation & Review System
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname?.startsWith(item.href));
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
            >
              <Github className="w-5 h-5" />
            </a>
            <button
              onClick={checkOllamaStatus}
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 ${status.bgClass} border rounded-full cursor-pointer hover:opacity-90 transition-all`}
              title="Click to refresh status"
            >
              <div className={`w-2 h-2 ${status.dotClass} rounded-full`} />
              <status.Icon className={`w-3.5 h-3.5 ${status.textClass}`} />
              <span className={`text-xs font-medium ${status.textClass}`}>{status.text}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
