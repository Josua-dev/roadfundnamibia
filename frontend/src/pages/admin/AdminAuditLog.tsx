import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, History, ChevronDown } from 'lucide-react';
import api from '../../utils/api';
import { Panel, FilterRail, FilterGroup, Empty, Skel, Pager } from '../../components/common';
import { formatDateTime, timeAgo } from '../../utils/helpers';

// Renders e.g. "UPDATE_REPORT_STATUS:completed" as "Update Report Status"
// with the suffix shown separately as a small tag, since several actions
// carry a colon-separated detail (status/role reached) worth keeping
// visually distinct from the action name itself.
const splitAction = (action: string) => {
  const [base, detail] = action.split(':');
  return { label: base.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), detail };
};

const ENTITY_LABELS: Record<string, string> = {
  reports: 'Report', users: 'User', maintenance_tasks: 'Task',
};

export default function AdminAuditLog() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const { data: meta } = useQuery({
    queryKey: ['audit-meta'],
    queryFn: async () => (await api.get('/audit-logs/meta')).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, entityFilter],
    queryFn: async () => {
      const p = new URLSearchParams({
        page: String(page), limit: '20',
        ...(actionFilter && { action: actionFilter }),
        ...(entityFilter && { entity_type: entityFilter }),
      });
      return (await api.get(`/audit-logs?${p}`)).data;
    },
  });

  const logs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <h1 className="text-h1" style={{ margin: 0 }}>Audit Log</h1>
        <p className="text-meta" style={{ margin: '3px 0 0' }}>{pagination?.total ?? 0} recorded actions — logins, submissions, status changes, and admin actions across the system</p>
      </div>

      <div style={{ display: 'flex', gap: 24 }} className="audit-layout">
        <FilterRail title="Filter">
          <FilterGroup label="Action">
            <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }} className="input input-sm">
              <option value="">All actions</option>
              {(meta?.actions || []).map((a: string) => <option key={a} value={a}>{splitAction(a).label}</option>)}
            </select>
          </FilterGroup>
          <FilterGroup label="Entity">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {[['', 'All'], ...(meta?.entity_types || []).map((t: string) => [t, ENTITY_LABELS[t] || t])].map(([v, l]) => (
                <button key={v} onClick={() => { setEntityFilter(v); setPage(1); }}
                  className="btn-quiet" style={{ justifyContent: 'flex-start', width: '100%', background: entityFilter === v ? 'var(--secondary-100)' : 'transparent', color: entityFilter === v ? 'var(--secondary-700)' : 'var(--text-2)', fontWeight: entityFilter === v ? 600 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
          </FilterGroup>
        </FilterRail>

        <Panel variant="bordered" style={{ flex: 1, minWidth: 0 }}>
          {isLoading ? <div style={{ padding: 18 }}><Skel rows={8} height={44} /></div> : !logs.length ? (
            <Empty icon={History} title="No matching activity" description="Try a different filter, or clear it to see everything." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className="dtable" style={{ minWidth: 680 }}>
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th></tr></thead>
              <tbody>
                {logs.map((log: any) => {
                  const { label, detail } = splitAction(log.action);
                  return (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }} title={formatDateTime(log.created_at)}>{timeAgo(log.created_at)}</td>
                      <td style={{ fontWeight: 500 }}>{log.user_name || 'System / deleted user'}</td>
                      <td>
                        {label}
                        {detail && <span className="tag tag-info" style={{ marginLeft: 6, fontSize: '0.68rem' }}>{detail}</span>}
                      </td>
                      <td style={{ color: 'var(--text-2)' }}>
                        {ENTITY_LABELS[log.entity_type] || log.entity_type || '—'}
                        {log.entity_id ? <span className="text-mono" style={{ color: 'var(--text-3)' }}> #{log.entity_id}</span> : null}
                      </td>
                      <td className="text-mono" style={{ color: 'var(--text-3)', fontSize: '0.74rem' }}>{log.ip_address || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
          <div className="panel-body" style={{ paddingTop: 0 }}>
            <Pager page={page} pages={pagination?.pages || 1} onPage={setPage} />
          </div>
        </Panel>
      </div>

      <style>{`@media (max-width: 820px) { .audit-layout { flex-direction: column; } }`}</style>
    </div>
  );
}
