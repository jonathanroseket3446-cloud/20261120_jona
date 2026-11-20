import React, { useState, useEffect } from 'react';
import ResultsViewer from './ResultsViewer';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  PlayCircle,
  AlertTriangle,
  Loader2,
  XCircle,
  Trash2,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileArchive,
  FileText,
  RefreshCw
} from 'lucide-react';
import { JobBatch, TargetStatus } from '../types';

interface TasksProps {
  sshConnected: boolean;
  remoteBasePath: string;
}

export default function Tasks({ sshConnected, remoteBasePath }: TasksProps) {
  const [batches, setBatches] = useState<JobBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmBatchAction, setConfirmBatchAction] = useState<{ id: string; action: 'cancel' | 'delete' } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingResultsFor, setViewingResultsFor] = useState<string | null>(null);
  const RECORDS_PER_PAGE = 50;

  const fetchJobs = async () => {
    if (!sshConnected) return;
    try {
      setLoading(true);
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteBasePath })
      });
      const data = await res.json();
      if (!res.ok) {
        if (!data.error?.includes('SSH Client is not connected') && !data.error?.includes('SSH Config is missing')) {
          throw new Error(data.error || 'Failed to fetch jobs');
        }
      } else {
        setBatches(Array.isArray(data) ? data : []);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [sshConnected]);

  const handleCancelTarget = async (batchId: string, targetName: string) => {
    try {
      await fetch(`/api/jobs/${batchId}/cancel/${encodeURIComponent(targetName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteBasePath })
      });
      fetchJobs();
    } catch {}
  };

  const handleDeleteTarget = async (batchId: string, targetName: string) => {
    try {
      await fetch(`/api/jobs/${batchId}/delete/${encodeURIComponent(targetName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteBasePath })
      });
      setConfirmDelete(null);
      fetchJobs();
    } catch {}
  };

  const handleBatchCancel = async (batchId: string) => {
    try {
      await fetch(`/api/jobs/${batchId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteBasePath })
      });
      setConfirmBatchAction(null);
      fetchJobs();
    } catch {}
  };

  const handleBatchDelete = async (batchId: string) => {
    try {
      await fetch(`/api/jobs/${batchId}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteBasePath })
      });
      setConfirmBatchAction(null);
      fetchJobs();
    } catch {}
  };

  type FlattenedRecord = TargetStatus & { batchId: string };
  const allRecords: FlattenedRecord[] = (batches || []).flatMap(b =>
    (b.targets || []).map(t => ({ ...t, batchId: b.id }))
  );
  const totalPages = Math.max(1, Math.ceil(allRecords.length / RECORDS_PER_PAGE));
  const currentRecords = allRecords.slice((currentPage - 1) * RECORDS_PER_PAGE, currentPage * RECORDS_PER_PAGE);

  const groupedRecords = currentRecords.reduce((acc, record) => {
    if (!acc[record.batchId]) acc[record.batchId] = [];
    acc[record.batchId].push(record);
    return acc;
  }, {} as Record<string, FlattenedRecord[]>);

  const StatusBadge = ({ status }: { status: TargetStatus['status'] | string }) => {
    const config =
      {
        Completed: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
        Running: { icon: PlayCircle, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
        Predicting: { icon: PlayCircle, color: 'text-brand-700', bg: 'bg-brand-50 border-brand-200' },
        Preprocessing: { icon: PlayCircle, color: 'text-brand-700', bg: 'bg-brand-50 border-brand-200' },
        'Pending Fold': { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
        'Pending MSA': { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
        'Failed/Unknown': { icon: AlertTriangle, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
        'Failed/Stopped': { icon: AlertTriangle, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' }
      }[status as string] || { icon: Clock, color: 'text-surface-700', bg: 'bg-surface-50 border-surface-200' };

    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase border ${config.bg} ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };

  if (!sshConnected) {
    return (
      <div className="p-10 text-center text-surface-500 bg-white border border-surface-200 rounded-2xl shadow-xs max-w-xl mx-auto mt-8">
        <WifiOff className="w-10 h-10 mx-auto mb-3 text-surface-300" />
        <h3 className="text-base font-bold text-surface-900 mb-1 font-display">SSH Cluster Offline</h3>
        <p className="text-xs text-surface-500">
          Connect to your HPC cluster in Settings to monitor batch progress and view profiling tables.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto animate-in fade-in duration-200">
      <div className="bg-white border border-surface-200 rounded-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-surface-900 font-display">Batch Queue & Results</h2>
          <p className="text-xs text-surface-500 mt-0.5">
            Monitor cluster folding & profiling tasks or open interactive 4-Tier developability tables
          </p>
        </div>
        <button
          onClick={fetchJobs}
          disabled={loading || !sshConnected}
          className="inline-flex items-center gap-1.5 bg-surface-50 border border-surface-200 hover:bg-surface-100 text-surface-700 py-2 px-3.5 rounded-lg text-xs font-semibold transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-surface-500" />
          )}
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {Object.keys(groupedRecords).length === 0 ? (
        <div className="bg-white border border-surface-200 rounded-2xl p-12 text-center shadow-xs">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2.5 text-surface-300" />
          <p className="text-sm font-semibold text-surface-700">No active or completed batches found</p>
          <p className="text-xs text-surface-500 mt-1">Submit FASTA or PDB files in the Pipeline tab to start</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedRecords).map(([batchId, records]) => (
            <div key={batchId} className="bg-white border border-surface-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-surface-200 bg-surface-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-50 text-brand-600 rounded-lg border border-brand-100 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-surface-900 font-mono">{batchId}</span>
                      <span className="text-[11px] font-medium text-surface-500 bg-white px-2 py-0.5 rounded border border-surface-200">
                        {records.length} target{records.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setViewingResultsFor(batchId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    View Analysis
                  </button>

                  <a
                    href={`/api/jobs/${batchId}/download?type=results&remoteBasePath=${encodeURIComponent(remoteBasePath)}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-surface-200 hover:bg-surface-50 text-surface-700 rounded-lg text-xs font-semibold transition-colors"
                    title="Download CSV & PDB Only"
                  >
                    <FileText className="w-3.5 h-3.5 text-brand-600" />
                    Results (.tar.gz)
                  </a>

                  <a
                    href={`/api/jobs/${batchId}/download?type=all&remoteBasePath=${encodeURIComponent(remoteBasePath)}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-surface-200 hover:bg-surface-50 text-surface-700 rounded-lg text-xs font-semibold transition-colors"
                    title="Download All Files"
                  >
                    <FileArchive className="w-3.5 h-3.5 text-surface-500" />
                    All (.tar.gz)
                  </a>

                  {confirmBatchAction?.id === batchId ? (
                    <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
                      <span className="text-xs font-bold text-rose-800">
                        {confirmBatchAction.action === 'cancel' ? 'Cancel?' : 'Delete?'}
                      </span>
                      <button
                        onClick={() =>
                          confirmBatchAction.action === 'cancel'
                            ? handleBatchCancel(batchId)
                            : handleBatchDelete(batchId)
                        }
                        className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setConfirmBatchAction(null)}
                        className="px-2 py-1 bg-white text-surface-600 text-[11px] font-bold rounded border border-surface-200"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmBatchAction({ id: batchId, action: 'cancel' })}
                        className="inline-flex items-center gap-1 bg-white border border-surface-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-surface-600 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors"
                        title="Cancel running jobs in batch"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                      <button
                        onClick={() => setConfirmBatchAction({ id: batchId, action: 'delete' })}
                        className="inline-flex items-center gap-1 bg-white border border-surface-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-surface-600 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-colors"
                        title="Delete batch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[480px]">
                  <thead>
                    <tr className="border-b border-surface-100 text-[11px] font-bold text-surface-500 uppercase tracking-wider bg-white">
                      <th className="py-2.5 px-5">Target Name</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {records.map(target => (
                      <tr key={`${batchId}-${target.name}`} className="hover:bg-surface-50/60 transition-colors group">
                        <td className="py-2.5 px-5 text-xs font-semibold text-surface-900 font-mono">{target.name}</td>
                        <td className="py-2.5 px-4">
                          <StatusBadge status={target.status} />
                        </td>
                        <td className="py-2.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {target.status === 'Completed' && (
                              <>
                                <a
                                  href={`/api/jobs/${batchId}/download/${encodeURIComponent(target.name)}?type=results&remoteBasePath=${encodeURIComponent(remoteBasePath)}`}
                                  download
                                  title="Download Target CSV & PDB"
                                  className="inline-flex items-center justify-center w-7 h-7 bg-white border border-surface-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 text-surface-500 rounded-lg transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </a>
                                <a
                                  href={`/api/jobs/${batchId}/download/${encodeURIComponent(target.name)}?type=all&remoteBasePath=${encodeURIComponent(remoteBasePath)}`}
                                  download
                                  title="Download All Target Files"
                                  className="inline-flex items-center justify-center w-7 h-7 bg-white border border-surface-200 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 text-surface-500 rounded-lg transition-colors"
                                >
                                  <FileArchive className="w-3.5 h-3.5" />
                                </a>
                              </>
                            )}

                            {['Predicting', 'Preprocessing', 'Pending Fold', 'Pending MSA'].includes(target.status) && (
                              <button
                                onClick={() => handleCancelTarget(batchId, target.name)}
                                title="Cancel Target"
                                className="inline-flex items-center justify-center w-7 h-7 bg-white border border-amber-200 hover:bg-amber-50 text-amber-600 rounded-lg transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {confirmDelete === `${batchId}-${target.name}` ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5">
                                <button
                                  onClick={() => handleDeleteTarget(batchId, target.name)}
                                  className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-2 py-0.5 bg-white text-surface-600 text-[10px] font-bold rounded border border-surface-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(`${batchId}-${target.name}`)}
                                title="Delete Target"
                                className="inline-flex items-center justify-center w-7 h-7 bg-white border border-surface-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-surface-500 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-surface-200 px-5 py-3 rounded-xl shadow-xs">
              <p className="text-xs text-surface-500">
                Showing <span className="font-semibold text-surface-900">{(currentPage - 1) * RECORDS_PER_PAGE + 1}</span>–
                <span className="font-semibold text-surface-900">
                  {Math.min(currentPage * RECORDS_PER_PAGE, allRecords.length)}
                </span>{' '}
                of <span className="font-semibold text-surface-900">{allRecords.length}</span> targets
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-surface-200 hover:bg-surface-50 text-surface-600 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-surface-700 px-2">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-surface-200 hover:bg-surface-50 text-surface-600 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {viewingResultsFor && (
        <ResultsViewer
          batchId={viewingResultsFor}
          remoteBasePath={remoteBasePath}
          onClose={() => setViewingResultsFor(null)}
        />
      )}
    </div>
  );
}
