'use client';

import { useState } from 'react';
import { Radio, Play, Pause, RefreshCw, Copy, Check, Terminal, FileCode, Settings, Database, Shield, Filter, Clock, Layers } from 'lucide-react';

type RaptorMode = 'record' | 'replay';

export default function RaptorPage() {
  const [mode, setMode] = useState<RaptorMode>('record');
  const [serviceName, setServiceName] = useState('my-service');
  const [upstreamUrl, setUpstreamUrl] = useState('http://localhost:8080');
  const [raptorPort, setRaptorPort] = useState('8081');
  const [copied, setCopied] = useState<string | null>(null);

  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getOnboardCommand = () => {
    return `tars onboard raptor --service-name ${serviceName} --upstream ${upstreamUrl}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg shadow-orange-500/20 mb-6">
            <Radio className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Raptor Traffic Recording
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Record and replay production traffic for deterministic testing.
            Capture real API interactions and replay them in isolation.
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl border border-orange-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">How Raptor Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <div className="font-medium text-slate-900">Record Mode</div>
                <p className="text-sm text-slate-600">
                  Raptor proxies traffic to your service, recording all requests and responses with timing data.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <div className="font-medium text-slate-900">Filter & Store</div>
                <p className="text-sm text-slate-600">
                  Sensitive data is filtered out using configurable rules before recordings are stored.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <div className="font-medium text-slate-900">Replay Mode</div>
                <p className="text-sm text-slate-600">
                  Replay recorded traffic during testing for consistent, deterministic test execution.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Raptor Mode</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('record')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                mode === 'record'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${mode === 'record' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Play className="w-5 h-5" />
                </div>
                <span className="font-semibold text-slate-900">Record Mode</span>
                {mode === 'record' && (
                  <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Proxy traffic through Raptor to capture requests/responses for later replay.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Capture Traffic</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Filter PII</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Store Recordings</span>
              </div>
            </button>

            <button
              onClick={() => setMode('replay')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                mode === 'replay'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${mode === 'replay' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <RefreshCw className="w-5 h-5" />
                </div>
                <span className="font-semibold text-slate-900">Replay Mode</span>
                {mode === 'replay' && (
                  <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Replay recorded traffic for deterministic, reproducible test execution.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Deterministic</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">No Network</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Fast</span>
              </div>
            </button>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Configuration</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Service Name
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="my-service"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Upstream URL
              </label>
              <input
                type="text"
                value={upstreamUrl}
                onChange={(e) => setUpstreamUrl(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="http://localhost:8080"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Raptor Port
              </label>
              <input
                type="text"
                value={raptorPort}
                onChange={(e) => setRaptorPort(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                placeholder="8081"
              />
            </div>
          </div>
        </div>

        {/* Generated Command */}
        <div className="bg-slate-900 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-orange-400" />
              <span className="text-sm font-medium text-slate-300">CLI Command</span>
            </div>
            <button
              onClick={() => copyCommand(getOnboardCommand(), 'main')}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all text-sm"
            >
              {copied === 'main' ? <Check className="w-4 h-4 text-orange-400" /> : <Copy className="w-4 h-4" />}
              {copied === 'main' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <code className="block text-orange-400 font-mono text-sm overflow-x-auto">
            {getOnboardCommand()}
          </code>
        </div>

        {/* What Gets Generated */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">What Gets Generated</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Settings, name: 'raptor.yml', desc: 'Main Raptor configuration' },
              { icon: Filter, name: 'default-filters.yml', desc: 'PII and sensitive data filters' },
              { icon: Database, name: 'sample-recording.json', desc: 'Example recording format' },
              { icon: Layers, name: 'docker-compose.raptor.yml', desc: 'Docker compose setup' },
              { icon: FileCode, name: 'raptor.md', desc: 'Documentation' },
            ].map((file) => (
              <div key={file.name} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <file.icon className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-900 text-sm">{file.name}</div>
                  <div className="text-xs text-slate-500">{file.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Default Filters</h2>
          <p className="text-sm text-slate-600 mb-4">
            Raptor automatically filters sensitive data from recordings to ensure compliance and privacy.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-600" />
                <span className="font-medium text-red-900 text-sm">Headers Filtered</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Authorization', 'Cookie', 'X-API-Key', 'X-Auth-Token', 'Set-Cookie'].map(h => (
                  <code key={h} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{h}</code>
                ))}
              </div>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-900 text-sm">Body Fields Filtered</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['password', 'secret', 'token', 'ssn', 'creditCard'].map(f => (
                  <code key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">{f}</code>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Commands */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Commands</h2>
          <div className="space-y-3">
            {[
              { label: 'Start Raptor', cmd: 'docker-compose -f docker-compose.raptor.yml up' },
              { label: 'Start Recording', cmd: `curl -X POST http://localhost:${raptorPort}/raptor/record/start -d '{"sessionName": "test-session"}'` },
              { label: 'Stop Recording', cmd: `curl -X POST http://localhost:${raptorPort}/raptor/record/stop` },
              { label: 'List Recordings', cmd: `curl http://localhost:${raptorPort}/raptor/recordings` },
              { label: 'Start Replay', cmd: `curl -X POST http://localhost:${raptorPort}/raptor/replay -d '{"recordingId": "recording-id"}'` },
              { label: 'Stop Replay', cmd: `curl -X POST http://localhost:${raptorPort}/raptor/replay/stop` },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="min-w-0 flex-1 mr-4">
                  <div className="text-sm font-medium text-slate-900">{item.label}</div>
                  <code className="text-xs text-slate-500 font-mono block truncate">{item.cmd}</code>
                </div>
                <button
                  onClick={() => copyCommand(item.cmd, `cmd-${i}`)}
                  className="flex-shrink-0 p-2 hover:bg-slate-200 rounded-lg transition-all"
                >
                  {copied === `cmd-${i}` ? (
                    <Check className="w-4 h-4 text-orange-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 mt-8 text-white">
          <h2 className="text-lg font-semibold mb-6">Raptor Architecture</h2>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex flex-col items-center p-4 bg-slate-700/50 rounded-xl">
              <Clock className="w-8 h-8 text-blue-400 mb-2" />
              <span className="text-sm font-medium">Client</span>
            </div>
            <div className="text-orange-400 text-2xl">→</div>
            <div className="flex flex-col items-center p-4 bg-orange-500/20 border border-orange-500 rounded-xl">
              <Radio className="w-8 h-8 text-orange-400 mb-2" />
              <span className="text-sm font-medium">Raptor Proxy</span>
              <span className="text-xs text-slate-400">Port {raptorPort}</span>
            </div>
            <div className="text-orange-400 text-2xl">→</div>
            <div className="flex flex-col items-center p-4 bg-slate-700/50 rounded-xl">
              <Layers className="w-8 h-8 text-emerald-400 mb-2" />
              <span className="text-sm font-medium">Service</span>
              <span className="text-xs text-slate-400">{upstreamUrl}</span>
            </div>
          </div>
          <div className="flex justify-center mt-4">
            <div className="text-center p-3 bg-slate-700/50 rounded-xl">
              <Database className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <span className="text-xs text-slate-400">Recordings Storage</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
