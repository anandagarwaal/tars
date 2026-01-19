'use client';

import { useState } from 'react';
import { Server, Code, Box, FileCode, Play, Copy, Check, Terminal, Database, Shield, Zap } from 'lucide-react';

type OnboardingMode = 'code-change' | 'mockoon';

export default function HermeticPage() {
  const [mode, setMode] = useState<OnboardingMode>('code-change');
  const [serviceName, setServiceName] = useState('my-service');
  const [entities, setEntities] = useState('User, Order, Product');
  const [dependencies, setDependencies] = useState('PaymentGateway, EmailService');
  const [copied, setCopied] = useState<string | null>(null);

  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getCommand = () => {
    const entitiesFlag = entities.trim() ? `--entities "${entities.trim()}"` : '';
    const depsFlag = dependencies.trim() ? `--dependencies "${dependencies.trim()}"` : '';
    return `tars onboard hermetic --service-name ${serviceName} --mode ${mode} ${entitiesFlag} ${depsFlag}`.trim().replace(/\s+/g, ' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg shadow-emerald-500/20 mb-6">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Hermetic Server Onboarding
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Create isolated, deterministic test environments for your services.
            Generate all the configuration needed for hermetic testing.
          </p>
        </div>

        {/* Mode Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Choose Onboarding Mode</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('code-change')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                mode === 'code-change'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${mode === 'code-change' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Code className="w-5 h-5" />
                </div>
                <span className="font-semibold text-slate-900">Code Change Mode</span>
                {mode === 'code-change' && (
                  <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Generate Java Spring Boot controllers, fake implementations, and configuration for full hermetic testing.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">SeedEntities API</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Reset API</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Fake Services</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">H2 Database</span>
              </div>
            </button>

            <button
              onClick={() => setMode('mockoon')}
              className={`p-6 rounded-xl border-2 transition-all text-left ${
                mode === 'mockoon'
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${mode === 'mockoon' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  <Box className="w-5 h-5" />
                </div>
                <span className="font-semibold text-slate-900">Mockoon Mode</span>
                {mode === 'mockoon' && (
                  <span className="ml-auto text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 mb-3">
                Generate Mockoon configuration with data buckets for lightweight mock API testing without code changes.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">No Code</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Data Buckets</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Fast Setup</span>
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Docker</span>
              </div>
            </button>
          </div>
        </div>

        {/* Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Configuration</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Service Name
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="my-service"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Entities (comma-separated)
              </label>
              <input
                type="text"
                value={entities}
                onChange={(e) => setEntities(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="User, Order, Product"
              />
            </div>
            {mode === 'code-change' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  External Dependencies to Fake (comma-separated)
                </label>
                <input
                  type="text"
                  value={dependencies}
                  onChange={(e) => setDependencies(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="PaymentGateway, EmailService, ExternalAPI"
                />
              </div>
            )}
          </div>
        </div>

        {/* Generated Command */}
        <div className="bg-slate-900 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-medium text-slate-300">CLI Command</span>
            </div>
            <button
              onClick={() => copyCommand(getCommand(), 'main')}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all text-sm"
            >
              {copied === 'main' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied === 'main' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <code className="block text-emerald-400 font-mono text-sm overflow-x-auto">
            {getCommand()}
          </code>
        </div>

        {/* What Gets Generated */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            What Gets Generated ({mode === 'code-change' ? 'Code Change' : 'Mockoon'} Mode)
          </h2>
          
          {mode === 'code-change' ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: FileCode, name: 'SeedEntitiesController.java', desc: 'API to seed test data' },
                { icon: FileCode, name: 'ResetDataController.java', desc: 'API to reset to base state' },
                { icon: FileCode, name: 'SampleDataController.java', desc: 'Sample payload provider' },
                { icon: Shield, name: 'RequestTracingFilter.java', desc: 'Request/response logging' },
                { icon: FileCode, name: 'FakeImplementations.java', desc: 'Mock external services' },
                { icon: Database, name: 'application-hermetic.yml', desc: 'H2 in-memory database config' },
                { icon: Box, name: 'Dockerfile.hermetic', desc: 'Hermetic Docker image' },
                { icon: Box, name: 'docker-compose.hermetic.yml', desc: 'Docker compose setup' },
                { icon: FileCode, name: 'pom-hermetic-profile.xml', desc: 'Maven build profile' },
                { icon: FileCode, name: 'hermetic-build.gradle.kts', desc: 'Gradle build config' },
                { icon: Zap, name: 'hermetic-publish.yml', desc: 'CI/CD GitHub Actions' },
                { icon: FileCode, name: 'hermetic.md', desc: 'Documentation' },
              ].map((file) => (
                <div key={file.name} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <file.icon className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{file.name}</div>
                    <div className="text-xs text-slate-500">{file.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Database, name: 'data-buckets.json', desc: 'Initial test data' },
                { icon: FileCode, name: 'environment.json', desc: 'Mockoon environment' },
                { icon: FileCode, name: 'user-routes.json', desc: 'User CRUD routes' },
                { icon: FileCode, name: 'order-routes.json', desc: 'Order CRUD routes' },
                { icon: FileCode, name: 'hermetic-routes.json', desc: 'Seed/Reset APIs' },
                { icon: Box, name: 'docker-compose.mockoon.yml', desc: 'Docker compose setup' },
                { icon: FileCode, name: 'hermetic-mockoon.md', desc: 'Documentation' },
              ].map((file) => (
                <div key={file.name} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <file.icon className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{file.name}</div>
                    <div className="text-xs text-slate-500">{file.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Commands */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Commands</h2>
          <div className="space-y-3">
            {[
              { label: 'Build Hermetic JAR (Maven)', cmd: 'mvn clean package -Pharmetic' },
              { label: 'Build Hermetic JAR (Gradle)', cmd: './gradlew bootHermeticJar' },
              { label: 'Run Hermetic Server', cmd: 'docker-compose -f docker-compose.hermetic.yml up' },
              { label: 'Run Mockoon Server', cmd: 'docker-compose -f docker-compose.mockoon.yml up' },
              { label: 'Seed Test Data', cmd: 'curl -X POST http://localhost:8080/hermetic/seedEntities -H "Content-Type: application/json" -d \'{"entities": []}\''},
              { label: 'Reset Server', cmd: 'curl -X POST http://localhost:8080/hermetic/reset' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.label}</div>
                  <code className="text-xs text-slate-500 font-mono">{item.cmd}</code>
                </div>
                <button
                  onClick={() => copyCommand(item.cmd, `cmd-${i}`)}
                  className="p-2 hover:bg-slate-200 rounded-lg transition-all"
                >
                  {copied === `cmd-${i}` ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
