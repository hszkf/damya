import { createFileRoute } from '@tanstack/react-router';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Plus,
  Clock,
  Mail,
  Edit3,
  Trash2,
  Play,
  Send,
  Pause,
  History,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
  Globe,
  MoreHorizontal,
} from 'lucide-react';
import { StudioNav } from '~/components/studio-nav';
import {
  listDeployments,
  createDeployment,
  updateDeployment,
  deleteDeployment,
  deployDeployment,
  undeployDeployment,
  runDeployment,
  getDeploymentRuns,
  listGlueJobs,
  type Deployment,
  type JobRun,
  type GlueJob,
  type CreateDeploymentRequest,
} from '~/lib/deployments-api';

export const Route = createFileRoute('/deployments')({
  component: DeploymentsPage,
});

const CRON_PRESETS = [
  { label: 'Daily 8AM MYT', value: '0 0 * * ?' },
  { label: 'Daily 9AM MYT', value: '0 1 * * ?' },
  { label: 'Hourly', value: '0 * * * ?' },
  { label: 'Weekdays 9AM', value: '0 1 ? * 2-6' },
];

function statusDot(status: string) {
  switch (status) {
    case 'deployed':
      return 'bg-emerald-400';
    case 'failed':
      return 'bg-red-400';
    default:
      return 'bg-zinc-500';
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'deployed':
      return 'text-emerald-400';
    case 'failed':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

function runStatusLabel(status: string) {
  switch (status) {
    case 'SUCCEEDED':
      return 'text-emerald-400';
    case 'RUNNING':
      return 'text-amber-400';
    case 'FAILED':
      return 'text-red-400';
    default:
      return 'text-zinc-400';
  }
}

function runStatusDot(status: string) {
  switch (status) {
    case 'SUCCEEDED':
      return 'bg-emerald-400';
    case 'RUNNING':
      return 'bg-amber-400';
    case 'FAILED':
      return 'bg-red-400';
    default:
      return 'bg-zinc-500';
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDate(ts: string | null): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleString();
}

function parseEmails(raw: string): string[] {
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

interface FormState {
  name: string;
  description: string;
  sql_query: string;
  cron_expression: string;
  email_to: string;
  email_cc: string;
  email_subject: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  sql_query: '',
  cron_expression: '0 0 * * ?',
  email_to: '',
  email_cc: '',
  email_subject: '',
};

// ---- Row action dropdown ----
function ActionMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
            {React.Children.map(children, child => (
              <div onClick={() => setOpen(false)}>{child}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ActionItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
        danger ? 'text-red-400 hover:bg-red-500/10' : 'text-neutral-300 hover:bg-neutral-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [glueJobs, setGlueJobs] = useState<GlueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [runsModal, setRunsModal] = useState<{ id: string; runs: JobRun[]; loading: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'delete' | 'deploy' | 'undeploy'; id: string; name: string } | null>(null);

  // Sort for external Glue jobs
  const [sortKey, setSortKey] = useState<'workers' | 'modified'>('modified');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: 'workers' | 'modified') => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ active }: { active: boolean }) => {
    if (!active) return <ChevronDown size={10} className="text-neutral-700" />;
    return sortDir === 'asc' ? <ChevronUp size={10} className="text-cyan-400" /> : <ChevronDown size={10} className="text-cyan-400" />;
  };

  const fetchDeployments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depsResult, jobsResult] = await Promise.allSettled([listDeployments(), listGlueJobs()]);
      if (depsResult.status === 'fulfilled') setDeployments(depsResult.value);
      if (jobsResult.status === 'fulfilled') setGlueJobs(jobsResult.value);
      if (depsResult.status === 'rejected') setError(depsResult.reason?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeployments(); }, [fetchDeployments]);

  const damyaJobNames = new Set(deployments.map(d => d.glue_job_name));
  const externalJobs = glueJobs.filter(j => !damyaJobNames.has(j.name));

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowEditor(true);
  };

  const openEdit = (dep: Deployment) => {
    setEditingId(dep.id);
    setForm({
      name: dep.name,
      description: dep.description || '',
      sql_query: dep.sql_query,
      cron_expression: dep.cron_expression,
      email_to: (dep.email_to || []).join(', '),
      email_cc: (dep.email_cc || []).join(', '),
      email_subject: dep.email_subject || '',
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: CreateDeploymentRequest = {
        name: form.name,
        description: form.description,
        sql_query: form.sql_query,
        cron_expression: form.cron_expression,
        email_to: parseEmails(form.email_to),
        email_cc: parseEmails(form.email_cc),
        email_subject: form.email_subject,
      };
      if (editingId) {
        await updateDeployment(editingId, payload);
      } else {
        await createDeployment(payload);
      }
      setShowEditor(false);
      await fetchDeployments();
    } catch (err: any) {
      alert(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (type: 'delete' | 'deploy' | 'undeploy', id: string) => {
    try {
      if (type === 'delete') await deleteDeployment(id);
      else if (type === 'deploy') await deployDeployment(id);
      else await undeployDeployment(id);
      setConfirm(null);
      await fetchDeployments();
    } catch (err: any) {
      alert(err?.message ?? `${type} failed`);
    }
  };

  const handleRun = async (id: string) => {
    try {
      await runDeployment(id);
      await fetchDeployments();
    } catch (err: any) {
      alert(err?.message ?? 'Run failed');
    }
  };

  const openRuns = async (id: string) => {
    setRunsModal({ id, runs: [], loading: true });
    try {
      const runs = await getDeploymentRuns(id);
      setRunsModal({ id, runs, loading: false });
    } catch (err: any) {
      setRunsModal({ id, runs: [], loading: false });
      alert(err?.message ?? 'Failed to load runs');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-neutral-200">
      <StudioNav />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
              <p className="text-sm text-neutral-500">Manage AWS Glue jobs &amp; scheduled reports</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-500 transition-colors"
            >
              <Plus size={16} />
              New Deployment
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
              <button onClick={fetchDeployments} className="ml-3 underline">Retry</button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-cyan-500" />
              <span className="ml-3 text-neutral-400">Loading...</span>
            </div>
          )}

          {!loading && (
            <>
              {/* === Damya Deployments Table === */}
              {deployments.length > 0 && (
                <section>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">Your Deployments</h2>
                  <div className="overflow-hidden rounded-xl border border-neutral-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-neutral-900/80 text-left">
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Name</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Status</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Schedule</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Last Run</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Recipients</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Created</th>
                          <th className="w-12 px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60">
                        {deployments.map(dep => (
                          <tr key={dep.id} className="group bg-neutral-900/30 hover:bg-neutral-800/40 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-neutral-200">{dep.name}</div>
                              {dep.description && <div className="mt-0.5 text-xs text-neutral-500 truncate max-w-[200px]">{dep.description}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5">
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot(dep.status)}`} />
                                <span className={`text-xs font-medium capitalize ${statusLabel(dep.status)}`}>{dep.status}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <Clock size={12} className="text-neutral-600" />
                                <code className="text-xs font-mono text-neutral-400">{dep.cron_expression}</code>
                                <button onClick={() => navigator.clipboard.writeText(dep.cron_expression)} className="text-neutral-700 hover:text-neutral-400 transition-colors" title="Copy">
                                  <Copy size={10} />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {dep.last_run_at ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-neutral-400">{formatDate(dep.last_run_at)}</span>
                                  {dep.last_run_status && (
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${runStatusLabel(dep.last_run_status)}`}>
                                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${runStatusDot(dep.last_run_status!)}`} />
                                      {dep.last_run_status}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-neutral-600">Never</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {dep.email_to?.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <Mail size={12} className="text-neutral-600 shrink-0" />
                                  <span className="text-xs text-neutral-400 truncate max-w-[160px]">{dep.email_to.join(', ')}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-neutral-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(dep.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleRun(dep.id)} title="Run Now" className="rounded p-1 text-cyan-400 hover:bg-cyan-500/10 transition-colors">
                                  <Play size={14} />
                                </button>
                                {dep.status !== 'deployed' ? (
                                  <button onClick={() => setConfirm({ type: 'deploy', id: dep.id, name: dep.name })} title="Deploy" className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                                    <Send size={14} />
                                  </button>
                                ) : (
                                  <button onClick={() => setConfirm({ type: 'undeploy', id: dep.id, name: dep.name })} title="Undeploy" className="rounded p-1 text-amber-400 hover:bg-amber-500/10 transition-colors">
                                    <Pause size={14} />
                                  </button>
                                )}
                                <ActionMenu>
                                  <ActionItem icon={<Edit3 size={13} />} label="Edit" onClick={() => openEdit(dep)} />
                                  <ActionItem icon={<History size={13} />} label="Run History" onClick={() => openRuns(dep.id)} />
                                  <ActionItem icon={<Trash2 size={13} />} label="Delete" onClick={() => setConfirm({ type: 'delete', id: dep.id, name: dep.name })} danger />
                                </ActionMenu>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* === External Glue Jobs Table === */}
              {externalJobs.length > 0 && (() => {
                const sorted = [...externalJobs].sort((a, b) => {
                  const dir = sortDir === 'asc' ? 1 : -1;
                  if (sortKey === 'workers') return (a.number_of_workers - b.number_of_workers) * dir;
                  return ((a.last_modified_on || '').localeCompare(b.last_modified_on || '')) * dir;
                });

                return (
                <section className={deployments.length > 0 ? 'mt-8' : ''}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    <Globe size={12} className="mr-1 inline -mt-px" />
                    Other AWS Glue Jobs
                    <span className="ml-2 text-neutral-600">({externalJobs.length})</span>
                  </h2>
                  <div className="overflow-hidden rounded-xl border border-neutral-800/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-neutral-900/60 text-left">
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Job Name</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Version</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-neutral-300 transition-colors" onClick={() => toggleSort('workers')}>
                            <span className="inline-flex items-center gap-1">Workers <SortIcon active={sortKey === 'workers'} /></span>
                          </th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Timeout</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500">Script</th>
                          <th className="px-4 py-3 text-xs font-medium text-neutral-500 cursor-pointer select-none hover:text-neutral-300 transition-colors" onClick={() => toggleSort('modified')}>
                            <span className="inline-flex items-center gap-1">Modified <SortIcon active={sortKey === 'modified'} /></span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/40">
                        {sorted.map(job => (
                          <tr key={job.name} className="bg-neutral-900/20 hover:bg-neutral-800/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-neutral-300">{job.name}</div>
                              {job.description && <div className="mt-0.5 text-xs text-neutral-600 truncate max-w-[220px]">{job.description}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-neutral-500">{job.glue_version || '-'}</td>
                            <td className="px-4 py-2.5 text-xs text-neutral-400">{job.worker_type} x{job.number_of_workers}</td>
                            <td className="px-4 py-2.5 text-xs text-neutral-500">{job.timeout}m</td>
                            <td className="px-4 py-2.5">
                              <code className="text-xs text-neutral-600 font-mono truncate block max-w-[240px]">{job.command.script_location || '-'}</code>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-neutral-500">{formatDate(job.last_modified_on)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                );
              })()}

              {/* Empty */}
              {deployments.length === 0 && externalJobs.length === 0 && !error && (
                <div className="flex flex-col items-center py-24 text-center">
                  <Clock size={48} className="mb-4 text-neutral-700" />
                  <p className="text-lg font-medium text-neutral-400">No deployments yet</p>
                  <p className="mt-1 text-sm text-neutral-600">Create your first Glue job deployment.</p>
                  <button onClick={openCreate} className="mt-6 flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 transition-colors">
                    <Plus size={16} />
                    New Deployment
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Editor Modal */}
      {showEditor && (
        <EditorModal
          form={form}
          setForm={setForm}
          saving={saving}
          isEdit={!!editingId}
          onSave={handleSave}
          onClose={() => setShowEditor(false)}
        />
      )}

      {/* Run History Modal */}
      {runsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setRunsModal(null); }}>
          <div className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Run History</h2>
              <button onClick={() => setRunsModal(null)} className="rounded-md p-1 text-neutral-400 hover:text-neutral-200"><X size={20} /></button>
            </div>
            {runsModal.loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                <span className="ml-3 text-sm text-neutral-400">Loading...</span>
              </div>
            ) : runsModal.runs.length === 0 ? (
              <div className="py-12 text-center text-sm text-neutral-500">No runs found.</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-neutral-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-800/60 text-left">
                      <th className="px-4 py-3 text-xs font-medium text-neutral-500">Status</th>
                      <th className="px-4 py-3 text-xs font-medium text-neutral-500">Started</th>
                      <th className="px-4 py-3 text-xs font-medium text-neutral-500">Duration</th>
                      <th className="px-4 py-3 text-xs font-medium text-neutral-500">Trigger</th>
                      <th className="px-4 py-3 text-xs font-medium text-neutral-500">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {runsModal.runs.map((run, i) => (
                      <tr key={run.id || i} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${runStatusLabel(run.status)}`}>
                            {run.status === 'RUNNING' && <Loader2 size={10} className="animate-spin" />}
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${runStatusDot(run.status)}`} />
                            {run.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-neutral-400">{formatDate(run.started_on)}</td>
                        <td className="px-4 py-3 text-xs text-neutral-400">{formatDuration(run.execution_time)}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{run.trigger_type}</td>
                        <td className="max-w-xs truncate px-4 py-3 text-xs text-red-400/80">{run.error_message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="mx-4 w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold">
              {confirm.type === 'delete' ? 'Delete' : confirm.type === 'deploy' ? 'Deploy' : 'Undeploy'}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {confirm.type === 'delete'
                ? `Delete "${confirm.name}"? This cannot be undone.`
                : confirm.type === 'deploy'
                  ? `Deploy "${confirm.name}" to AWS Glue?`
                  : `Undeploy "${confirm.name}"? The scheduled trigger will stop.`}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors">Cancel</button>
              <button
                onClick={() => handleAction(confirm!.type, confirm!.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                  confirm.type === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-cyan-600 hover:bg-cyan-500'
                }`}
              >
                {confirm.type === 'delete' ? 'Delete' : confirm.type === 'deploy' ? 'Deploy' : 'Undeploy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Editor Modal ----

interface EditorModalProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  isEdit: boolean;
  onSave: () => void;
  onClose: () => void;
}

function EditorModal({ form, setForm, saving, isEdit, onSave, onClose }: EditorModalProps) {
  const [showPresets, setShowPresets] = useState(false);
  const inputCls = 'w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-colors';
  const labelCls = 'mb-1.5 block text-xs font-medium text-neutral-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit' : 'New'} Deployment</h2>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:text-neutral-200 transition-colors"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="daily-sales-summary" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>SQL Query *</label>
            <textarea
              value={form.sql_query}
              onChange={e => setForm(f => ({ ...f, sql_query: e.target.value }))}
              placeholder="SELECT * FROM my_table WHERE date = '{report_date}'"
              rows={8}
              className={`${inputCls} font-mono text-xs leading-relaxed resize-y`}
            />
            <p className="mt-1 text-xs text-neutral-600">Use <code className="text-neutral-500">{'{report_date}'}</code> for yesterday&apos;s date</p>
          </div>

          <div>
            <label className={labelCls}>Cron Schedule</label>
            <div className="flex gap-2">
              <input type="text" value={form.cron_expression} onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))} className={`${inputCls} font-mono flex-1`} />
              <div className="relative">
                <button type="button" onClick={() => setShowPresets(p => !p)} className="h-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 text-xs font-medium text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200 transition-colors flex items-center gap-1">
                  Presets <ChevronDown size={12} />
                </button>
                {showPresets && (
                  <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
                    {CRON_PRESETS.map(p => (
                      <button key={p.value} type="button" onClick={() => { setForm(f => ({ ...f, cron_expression: p.value })); setShowPresets(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-neutral-700 transition-colors">
                        <span className="text-neutral-300">{p.label}</span>
                        <code className="text-neutral-600">{p.value}</code>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email To *</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
                <input type="text" value={form.email_to} onChange={e => setForm(f => ({ ...f, email_to: e.target.value }))} placeholder="user1@co.com, user2@co.com" className={`${inputCls} pl-8`} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Email CC</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
                <input type="text" value={form.email_cc} onChange={e => setForm(f => ({ ...f, email_cc: e.target.value }))} placeholder="cc@co.com" className={`${inputCls} pl-8`} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Email Subject</label>
            <input type="text" value={form.email_subject} onChange={e => setForm(f => ({ ...f, email_subject: e.target.value }))} placeholder="Report - {report_date}" className={inputCls} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-neutral-800 pt-4">
          <button onClick={onClose} className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors">Cancel</button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.sql_query.trim()}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
