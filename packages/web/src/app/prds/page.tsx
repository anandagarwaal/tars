'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Clock, CheckCircle, Trash2, ExternalLink, AlertCircle, Plus, Copy, Check } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PRD {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function PRDsPage() {
  const [prds, setPrds] = useState<PRD[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchPRDs();
  }, []);

  const fetchPRDs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/prd`);
      if (response.ok) {
        const data = await response.json();
        setPrds(data);
      }
    } catch (error) {
      console.error('Failed to fetch PRDs:', error);
    } finally {
      setLoading(false);
    }
  };

  const deletePRD = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/api/prd/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setPrds(prds.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete PRD:', error);
    } finally {
      setDeleteId(null);
    }
  };

  const copyCommand = (id: string) => {
    navigator.clipboard.writeText(`tars generate --prd ${id} --framework jest`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-amber-600 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'processing':
        return 'bg-amber-50 border-amber-200 text-amber-700';
      default:
        return 'bg-slate-100 border-slate-200 text-slate-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">PRD History</h1>
          <p className="text-slate-600 mt-1">All uploaded Product Requirements Documents</p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:from-indigo-500 hover:to-violet-500 transition-all flex items-center gap-2 font-semibold shadow-lg shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Upload New PRD
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-indigo-600">{prds.length}</div>
          <div className="text-sm text-slate-600 font-medium mt-1">Total PRDs</div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-emerald-600">
            {prds.filter(p => p.status === 'completed').length}
          </div>
          <div className="text-sm text-slate-600 font-medium mt-1">Completed</div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="text-3xl font-bold text-amber-600">
            {prds.filter(p => p.status === 'processing').length}
          </div>
          <div className="text-sm text-slate-600 font-medium mt-1">Processing</div>
        </div>
      </div>

      {/* PRD List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : prds.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-xl font-semibold text-slate-700">No PRDs uploaded yet</p>
          <p className="text-slate-500 mt-2 mb-6">
            Upload your first PRD to generate test scenarios
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/20"
          >
            <FileText className="w-4 h-4" />
            Upload PRD
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {prds.map((prd) => (
            <div
              key={prd.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{prd.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusIcon(prd.status)}
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(prd.status)}`}>
                            {prd.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                      {truncateContent(prd.content)}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(prd.created_at)}
                      </span>
                      <span className="font-mono bg-slate-100 px-2 py-1 rounded">
                        ID: {prd.id.substring(0, 8)}...
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <Link
                      href={`/scenarios?prdId=${prd.id}`}
                      className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="View Scenarios"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </Link>
                    <button
                      onClick={() => setDeleteId(prd.id)}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      title="Delete PRD"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Delete Confirmation */}
              {deleteId === prd.id && (
                <div className="p-4 bg-rose-50 border-t border-rose-200">
                  <p className="text-sm text-rose-700 mb-3 font-medium">
                    Delete this PRD and all associated scenarios?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => deletePRD(prd.id)}
                      className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 transition-all font-medium"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-all font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CLI Reference */}
      {prds.length > 0 && (
        <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl">
          <h3 className="font-bold text-white mb-4 text-lg">Generate Tests via CLI</h3>
          <div className="space-y-3">
            {prds.slice(0, 3).map((prd) => (
              <div key={prd.id} className="flex items-center gap-3">
                <code className="flex-1 p-3 bg-slate-950 rounded-lg text-sm font-mono text-slate-300 border border-slate-700">
                  tars generate --prd {prd.id} --framework jest
                </code>
                <button
                  onClick={() => copyCommand(prd.id)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    copiedId === prd.id 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {copiedId === prd.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
