'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Clock, Filter, ChevronDown, ChevronRight, Play, Download, TestTube } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Scenario {
  id: string;
  prd_id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  steps: { action: string; expected: string }[];
  test_data: Record<string, unknown>;
  tags: string[];
}

function ScenariosContent() {
  const searchParams = useSearchParams();
  const prdId = searchParams.get('prdId');
  
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchScenarios();
  }, [prdId, filter]);

  const fetchScenarios = async () => {
    try {
      let url = `${API_URL}/api/scenarios`;
      const params = new URLSearchParams();
      if (prdId) params.append('prdId', prdId);
      if (filter !== 'all') params.append('status', filter);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setScenarios(data);
      }
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await fetch(`${API_URL}/api/scenarios/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchScenarios();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const approveAll = async () => {
    const pendingIds = scenarios.filter(s => s.status === 'pending').map(s => s.id);
    if (pendingIds.length === 0) return;

    try {
      await fetch(`${API_URL}/api/scenarios/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioIds: pendingIds }),
      });
      fetchScenarios();
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      default:
        return <Clock className="w-5 h-5 text-amber-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'rejected':
        return 'bg-rose-50 border-rose-200 text-rose-700';
      default:
        return 'bg-amber-50 border-amber-200 text-amber-700';
    }
  };

  const stats = {
    total: scenarios.length,
    pending: scenarios.filter(s => s.status === 'pending').length,
    approved: scenarios.filter(s => s.status === 'approved').length,
    rejected: scenarios.filter(s => s.status === 'rejected').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Test Scenarios</h1>
          <p className="text-slate-600 mt-1">Review and approve generated test scenarios</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={approveAll}
            disabled={stats.pending === 0}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            Approve All ({stats.pending})
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
          { label: 'Pending', value: stats.pending, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
          { label: 'Approved', value: stats.approved, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
          { label: 'Rejected', value: stats.rejected, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`p-5 ${stat.bg} border ${stat.border} rounded-xl`}
          >
            <div className={`text-3xl font-bold ${stat.text}`}>{stat.value}</div>
            <div className="text-sm text-slate-600 font-medium mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200">
        <Filter className="w-4 h-4 text-slate-400 ml-2" />
        <span className="text-sm text-slate-500 font-medium">Filter:</span>
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all ${
              filter === f
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Scenarios List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : scenarios.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <TestTube className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-700">No scenarios found</p>
          <p className="text-sm text-slate-500 mt-1">Upload a PRD to generate test scenarios</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all"
            >
              {/* Scenario Header */}
              <div
                className="p-5 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
              >
                <div className="flex items-center gap-4">
                  {expandedId === scenario.id ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  {getStatusIcon(scenario.status)}
                  <div>
                    <h3 className="font-semibold text-slate-900">{scenario.title}</h3>
                    <p className="text-sm text-slate-500">{scenario.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    scenario.priority === 'high'
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : scenario.priority === 'medium'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {scenario.priority}
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                    {scenario.type}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(scenario.status)}`}>
                    {scenario.status}
                  </span>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedId === scenario.id && (
                <div className="border-t border-slate-100 p-5 bg-slate-50">
                  {/* Steps */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">Test Steps</h4>
                    <div className="space-y-2 bg-white rounded-lg border border-slate-200 p-4">
                      {scenario.steps?.map((step, index) => (
                        <div key={index} className="flex gap-3 text-sm">
                          <span className="text-indigo-600 font-mono font-bold">{index + 1}.</span>
                          <div>
                            <span className="text-slate-700">{step.action}</span>
                            <span className="text-slate-400 mx-2">→</span>
                            <span className="text-emerald-600 font-medium">{step.expected}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  {scenario.tags && scenario.tags.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Tags</h4>
                      <div className="flex gap-2 flex-wrap">
                        {scenario.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {scenario.status === 'pending' && (
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(scenario.id, 'approved');
                        }}
                        className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-2 font-medium"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(scenario.id, 'rejected');
                        }}
                        className="px-5 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all flex items-center gap-2 font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CLI Instructions */}
      {stats.approved > 0 && (
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl">
          <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
            <Play className="w-5 h-5" />
            Ready to Generate Tests
          </h3>
          <p className="text-sm text-indigo-700 mb-4">
            You have {stats.approved} approved scenarios. Run the following command to generate tests:
          </p>
          <code className="block p-4 bg-slate-900 rounded-xl text-sm font-mono text-indigo-300">
            tars generate --prd {prdId || '<prd-id>'} --framework jest
          </code>
        </div>
      )}
    </div>
  );
}

// Loading fallback for Suspense
function ScenariosLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Export with Suspense wrapper to handle useSearchParams
export default function ScenariosPage() {
  return (
    <Suspense fallback={<ScenariosLoading />}>
      <ScenariosContent />
    </Suspense>
  );
}
