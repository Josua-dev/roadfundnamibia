import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, User, Wrench, DollarSign, Calendar } from 'lucide-react';
import api from '../../utils/api';
import { Panel, PanelHeader, TaskStatusTag, PriorityTag, SeverityTag, Meter, Skel, Notice } from '../../components/common';
import { formatDate, formatDateTime, formatCurrency, issueTypeConfig } from '../../utils/helpers';
import { TaskStatus } from '../../types';
import toast from 'react-hot-toast';

export default function MaintenanceTaskDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['maintenance-task', id],
    queryFn: async () => (await api.get(`/maintenance/${id}`)).data.data,
  });

  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [notes, setNotes] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [actualCompletion, setActualCompletion] = useState('');

  // Seed the form from the loaded task, only on first load (not on every
  // refetch), so the officer's in-progress edits don't get clobbered by
  // the query refetching in the background.
  const [seeded, setSeeded] = useState(false);
  if (task && !seeded) {
    setProgress(task.progress_percent ?? 0);
    setStatus(task.status);
    setNotes(task.notes || '');
    setActualCost(task.actual_cost != null ? String(task.actual_cost) : '');
    setActualCompletion(task.actual_completion ? task.actual_completion.slice(0, 10) : '');
    setSeeded(true);
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { progress_percent: progress, status, notes };
      if (actualCost.trim()) payload.actual_cost = Number(actualCost);
      if (actualCompletion) payload.actual_completion = actualCompletion;
      await api.patch(`/maintenance/${id}`, payload);
    },
    onSuccess: () => {
      toast.success('Task updated');
      qc.invalidateQueries({ queryKey: ['maintenance-task', id] });
      qc.invalidateQueries({ queryKey: ['my-tasks'] });
      qc.invalidateQueries({ queryKey: ['maintenance-stats'] });
    },
    onError: () => toast.error('Update failed'),
  });

  if (isLoading) return <Skel rows={6} height={80} />;
  if (error || !task) return <Notice type="error" message="Task not found or access denied." />;

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ marginTop: 2 }}><ArrowLeft size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="text-h1" style={{ margin: 0 }}>{task.report_title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span className="text-mono" style={{ color: 'var(--text-3)' }}>{task.report_number}</span>
            <span style={{ color: 'var(--n-200)' }}>·</span>
            <Link to={`/dashboard/reports/${task.report_id}`} className="btn-link" style={{ fontSize: '0.8rem' }}>View full report →</Link>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <PriorityTag priority={task.priority} />
          <TaskStatusTag status={task.status} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: 18 }} className="detail-split">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Panel variant="bordered">
            <div className="panel-body">
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--r-base)', background: 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Wrench size={17} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <div className="text-h3">{issueTypeConfig[task.issue_type as keyof typeof issueTypeConfig]?.label}</div>
                  <div style={{ marginTop: 4 }}><SeverityTag severity={task.severity} /></div>
                </div>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: '0.87rem', lineHeight: 1.7, margin: 0 }}>{task.description}</p>
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-2)' }}>Progress</span><span style={{ fontWeight: 700 }}>{task.progress_percent}%</span>
                </div>
                <Meter value={task.progress_percent} showLabel={false} />
              </div>
            </div>
          </Panel>

          <Panel variant="bordered">
            <PanelHeader title="Task Details" />
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[
                { Icon: User, label: 'Assigned team', value: task.assigned_team || 'Not set' },
                { Icon: User, label: 'Assigned officer', value: task.officer_name || 'Unassigned' },
                { Icon: User, label: 'Inspector', value: task.inspector_name || 'None' },
                { Icon: MapPin, label: 'Location', value: task.region_name, sub: task.address },
                { Icon: Calendar, label: 'Start date', value: task.start_date ? formatDate(task.start_date) : 'Not set' },
                { Icon: Calendar, label: 'Estimated completion', value: task.estimated_completion ? formatDate(task.estimated_completion) : 'Not set' },
                ...(task.actual_completion ? [{ Icon: Calendar, label: 'Actual completion', value: formatDate(task.actual_completion) }] : []),
                { Icon: DollarSign, label: 'Cost (estimated / actual)', value: `${formatCurrency(task.cost_estimate)} / ${formatCurrency(task.actual_cost)}` },
              ].map(({ Icon, label, value, sub }: any, i) => (
                <div key={i} style={{ display: 'flex', gap: 9 }}>
                  <Icon size={13} style={{ color: 'var(--text-3)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div className="text-label" style={{ marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: '0.83rem', fontWeight: 500 }}>{value}</div>
                    {sub && <div className="text-meta">{sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel variant="bordered">
            <PanelHeader title="Update Task" subtitle={`Created ${formatDateTime(task.created_at)}`} />
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label className="field-label">Status</label>
                <select className="input" value={status} onChange={e => {
                  const v = e.target.value as TaskStatus;
                  setStatus(v);
                  if (v === 'completed' && !actualCompletion) setActualCompletion(new Date().toISOString().slice(0, 10));
                }}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">Progress: {progress}%</label>
                <input type="range" min={0} max={100} step={5} value={progress ?? 0} onChange={e => setProgress(Number(e.target.value))} style={{ width: '100%' }} />
              </div>

              <div className="field">
                <label className="field-label">Notes</label>
                <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Work performed, blockers, materials used…" />
              </div>

              <div className="field">
                <label className="field-label">Actual cost (N$)</label>
                <input type="number" min={0} step="0.01" className="input" value={actualCost} onChange={e => setActualCost(e.target.value)} placeholder={task.cost_estimate ? `Estimated: ${task.cost_estimate}` : '0.00'} />
              </div>

              {status === 'completed' && (
                <div className="field">
                  <label className="field-label">Completion date</label>
                  <input type="date" className="input" value={actualCompletion} onChange={e => setActualCompletion(e.target.value)} />
                </div>
              )}

              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending}
                className="btn btn-cta"
                style={{ justifyContent: 'center', marginTop: 4 }}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save Update'}
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <style>{`@media (max-width: 840px) { .detail-split { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
