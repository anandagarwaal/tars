'use client';

import { useState, useEffect } from 'react';
import { FileText, TestTube, Server, Activity, TrendingUp, Clock, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function DashboardPage() {
  const [prds, setPrds] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalPrds: 0,
    totalScenarios: 0,
    approvedScenarios: 0,
    pendingScenarios: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch PRDs
      const prdsResponse = await fetch(`${API_URL}/api/prd`);
      if (prdsResponse.ok) {
        const prdsData = await prdsResponse.json();
        setPrds(prdsData);
        setStats(prev => ({ ...prev, totalPrds: prdsData.length }));
      }

      // Fetch Scenarios
      const scenariosResponse = await fetch(`${API_URL}/api/scenarios`);
      if (scenariosResponse.ok) {
        const scenariosData = await scenariosResponse.json();
        setStats(prev => ({
          ...prev,
          totalScenarios: scenariosData.length,
          approvedScenarios: scenariosData.filter((s: any) => s.status === 'approved').length,
          pendingScenarios: scenariosData.filter((s: any) => s.status === 'pending').length,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total PRDs',
      value: stats.totalPrds,
      icon: FileText,
      gradient: 'from-indigo-500 to-violet-500',
      bg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-100',
    },
    {
      title: 'Test Scenarios',
      value: stats.totalScenarios,
      icon: TestTube,
      gradient: 'from-violet-500 to-purple-500',
      bg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      borderColor: 'border-violet-100',
    },
    {
      title: 'Approved',
      value: stats.approvedScenarios,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Pending Review',
      value: stats.pendingScenarios,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-100',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of your testing automation</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((stat) => (
          <div
            key={stat.title}
            className={`relative overflow-hidden bg-white border ${stat.borderColor} rounded-2xl p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all group`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center mb-4`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
              <div className="text-3xl font-bold text-slate-900">{loading ? '-' : stat.value}</div>
              <div className="text-sm text-slate-500 mt-1 font-medium">{stat.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent PRDs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">Recent PRDs</h2>
            <a href="/" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
              Upload New
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : prds.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <p className="font-medium">No PRDs yet</p>
              <p className="text-sm mt-1">Upload a PRD to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prds.slice(0, 5).map((prd) => (
                <div
                  key={prd.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-200 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{prd.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(prd.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      prd.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : prd.status === 'processing'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {prd.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-5">Quick Actions</h2>
          
          <div className="space-y-3">
            <a
              href="/"
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-xl hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">
                  Upload PRD
                </h3>
                <p className="text-sm text-slate-500">Generate test scenarios from requirements</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </a>

            <a
              href="/scenarios"
              className="flex items-center gap-4 p-4 bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <TestTube className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                  Review Scenarios
                </h3>
                <p className="text-sm text-slate-500">Approve or reject generated scenarios</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-violet-600 transition-colors" />
            </a>

            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Server className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Hermetic Onboarding</h3>
                <p className="text-sm text-slate-500">
                  Run: <code className="px-2 py-0.5 bg-slate-900 text-emerald-400 rounded text-xs font-mono">tars onboard hermetic</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CLI Commands Reference */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-5">CLI Commands</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { cmd: 'tars analyze', desc: 'Analyze repository structure' },
            { cmd: 'tars generate --prd <id>', desc: 'Generate tests from PRD' },
            { cmd: 'tars onboard hermetic', desc: 'Onboard to Hermetic server' },
            { cmd: 'tars status', desc: 'Check onboarding status' },
          ].map((item) => (
            <div key={item.cmd} className="p-4 bg-slate-900 rounded-xl">
              <code className="text-indigo-400 font-mono text-sm">{item.cmd}</code>
              <p className="text-xs text-slate-400 mt-2">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
