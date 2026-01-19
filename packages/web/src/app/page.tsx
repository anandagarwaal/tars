'use client';

import { useState, useEffect } from 'react';
import { Upload, FileText, Sparkles, ArrowRight, CheckCircle2, Loader2, Zap, Shield, Clock, Bot } from 'lucide-react';
import { ActivityFeed } from '../components/ActivityFeed';
import { usePrdUpdates } from '../hooks/useWebSocket';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function Home() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [currentPrdId, setCurrentPrdId] = useState<string | null>(null);
  
  // WebSocket updates for current PRD
  const { isConnected, progress, status, scenarios: wsScenarios, error: wsError, reset } = usePrdUpdates(currentPrdId);
  
  // Update result with WebSocket scenarios for real-time feedback
  useEffect(() => {
    if (wsScenarios.length > 0 && currentPrdId) {
      setResult((prev: any) => ({
        ...prev,
        scenarios: wsScenarios,
      }));
    }
  }, [wsScenarios, currentPrdId]);
  
  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      setError(wsError);
      setIsLoading(false);
    }
  }, [wsError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResult(null);
    reset(); // Reset WebSocket state

    try {
      const response = await fetch(`${API_URL}/api/prd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, content }),
      });

      if (!response.ok) {
        throw new Error('Failed to process PRD');
      }

      const data = await response.json();
      setCurrentPrdId(data.prd?.id); // Set PRD ID for WebSocket tracking
      setResult(data);
    } catch (err) {
      setError('Failed to connect to API. Make sure the TARS API is running on port 3001.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSamplePRD = () => {
    setTitle('User Authentication Feature');
    setContent(`# User Authentication Feature

## Overview
Implement a secure user authentication system that allows users to register, login, and manage their sessions.

## Requirements

### User Registration
- Users should be able to register with email and password
- Email must be validated for correct format
- Password must be at least 8 characters with numbers and special characters
- Users should receive a confirmation email after registration

### User Login
- Users should be able to login with email and password
- Implement rate limiting for failed login attempts
- Support "Remember Me" functionality
- Implement secure session management

### Password Reset
- Users should be able to request password reset via email
- Reset links should expire after 24 hours
- Users must create a new password meeting security requirements

### Security
- Passwords must be hashed using bcrypt
- Implement CSRF protection
- Use HTTPS for all authentication endpoints
- Implement JWT tokens for session management

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
`);
  };

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Hero Section - Functionize Inspired */}
      <div className="text-center space-y-6 py-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          AI-Powered Test Generation
          <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full ml-1">NEW</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
          <span className="text-slate-900">Manual Testing is </span>
          <span className="gradient-text">Dead.</span>
          <br />
          <span className="text-slate-900">Build What&apos;s </span>
          <span className="gradient-text-teal">Next.</span>
        </h1>
        
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Say hello to testing that runs itself. Transform PRDs into comprehensive test scenarios 
          in <span className="font-semibold text-indigo-600">seconds</span>, not hours. 
          Built for teams who want to ship faster.
        </p>

        <div className="flex items-center justify-center gap-8 pt-4">
          {[
            { icon: Zap, text: '10x Faster', color: 'text-amber-600' },
            { icon: Shield, text: 'Privacy First', color: 'text-emerald-600' },
            { icon: Bot, text: 'Local AI', color: 'text-indigo-600' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className="text-sm font-medium text-slate-700">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Upload Form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Upload PRD</h2>
                <p className="text-sm text-slate-500">Paste your markdown content</p>
              </div>
            </div>
            <button
              onClick={loadSamplePRD}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"
            >
              Load Sample
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                PRD Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., User Authentication Feature"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                PRD Content (Markdown)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your PRD content here in markdown format..."
                rows={12}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-400 font-mono text-sm resize-none text-slate-900"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Scenarios...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Test Scenarios
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg shadow-slate-200/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Generated Scenarios</h2>
              <p className="text-sm text-slate-500">
                {result ? `${result.scenarios?.length || 0} scenarios generated` : 'Waiting for PRD...'}
              </p>
            </div>
          </div>

          {!result && !isLoading && (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Upload className="w-10 h-10 text-slate-300" />
              </div>
              <p className="font-medium text-slate-500">Upload a PRD to generate test scenarios</p>
              <p className="text-sm text-slate-400 mt-1">Our AI will analyze your requirements</p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center h-80 text-slate-600">
              <div className="relative mb-6">
                <div className="w-16 h-16 border-4 border-indigo-100 rounded-full" />
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute inset-0" />
              </div>
              <p className="font-semibold text-slate-700">Analyzing PRD with AI...</p>
              <p className="text-sm text-slate-500 mt-1">This may take a moment</p>
              
              {/* Real-time progress */}
              {isConnected && progress > 0 && (
                <div className="mt-6 w-full max-w-xs">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="font-medium text-indigo-600">Generating scenarios</span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {wsScenarios.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2 text-center">
                      {wsScenarios.length} scenario{wsScenarios.length !== 1 ? 's' : ''} generated
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {result && result.scenarios && (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {result.scenarios.map((scenario: any, index: number) => (
                <div
                  key={scenario.id || index}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      {scenario.title}
                    </h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      scenario.priority === 'high' 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : scenario.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      {scenario.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{scenario.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                      {scenario.type}
                    </span>
                    {scenario.tags?.map((tag: string) => (
                      <span key={tag} className="text-xs px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              <a
                href={`/scenarios?prdId=${result.prd?.id}`}
                className="flex items-center justify-center gap-2 w-full py-3 border-2 border-indigo-200 text-indigo-600 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all font-semibold"
              >
                View All Scenarios
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed />

      {/* Features Section - Functionize Inspired */}
      <div className="py-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900">
            The TARS Platform
          </h2>
          <p className="text-slate-600 mt-2">Built to end manual testing once and for all</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: '🎯',
              title: 'PRD Analysis',
              subtitle: 'Understand Your Requirements',
              description: 'AI reads and extracts testable scenarios from your product requirements documents automatically.',
              color: 'indigo',
            },
            {
              icon: '🧪',
              title: 'Test Generation',
              subtitle: 'Code in Seconds',
              description: 'Generate production-ready tests for Jest, JUnit, Cypress, Playwright and more frameworks.',
              color: 'violet',
            },
            {
              icon: '🔒',
              title: 'Hermetic Onboarding',
              subtitle: 'Isolated Environments',
              description: 'Automate setup of isolated test environments with in-memory databases and mocked services.',
              color: 'teal',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group p-8 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
              <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">
                {feature.subtitle}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-center">
        <h3 className="text-2xl font-bold text-white mb-2">
          Ready to Transform Your Testing?
        </h3>
        <p className="text-slate-400 mb-6">
          Join teams who ship faster with AI-powered test automation
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="px-6 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-all"
          >
            Get Started Free
          </button>
          <a
            href="/telemetry"
            className="px-6 py-3 border border-slate-600 text-slate-300 font-semibold rounded-xl hover:bg-slate-800 transition-all"
          >
            View Metrics
          </a>
        </div>
      </div>
    </div>
  );
}
