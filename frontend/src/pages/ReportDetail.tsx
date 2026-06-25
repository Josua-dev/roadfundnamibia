import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Calendar, User, Paperclip, CheckCircle, Wrench } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { Report, ReportStatus } from '../types';
import { Panel, PanelHeader, StatusTag, SeverityTag, Meter, Skel, Notice, AttachmentThumb } from '../components/common';
import { formatDateTime, timeAgo, issueTypeConfig, statusConfig } from '../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_FLOW: ReportStatus[] = ['reported', 'under_review', 'verified', 'assigned', 'in_progress', 'completed'];

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const { isStaff, isAdmin, isInspector } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusNote, setStatusNote] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['report', id],
    queryFn: async () => (await api.get(`/reports/${id}`)).data.data as Report & { attachments: any[]; history: any[]; maintenance_task: any; inspections: any[] },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes: string }) => { await api.patch(`/reports/${id}/status`, { status, notes }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['report', id] }); toast.success('Status updated'); setStatusNote(''); },
  });

  const [findings, setFindings] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [verified, setVerified] = useState(false);
  const inspectionMutation = useMutation({
    mutationFn: async () => { await api.post(`/reports/${id}/inspections`, { findings, recommendation, verified }); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report', id] });
      toast.success('Findings recorded');
      setFindings(''); setRecommendation(''); setVerified(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to record findings'),
  });

  if (isLoading) return <Skel rows={6} height={80} />;
  if (error || !data) return <Notice type="error" message="Report not found or access denied." />;

  const currentIdx = STATUS_FLOW.indexOf(data.status);

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <button onClick={() => navigate(-1)} className="btn-icon" style={{ marginTop: 2 }}><ArrowLeft size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="text-h1" style={{ margin: 0 }}>{data.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <span className="text-mono" style={{ color: 'var(--text-3)' }}>{data.report_number}</span>
            <span style={{ color: 'var(--n-200)' }}>·</span>
            <span className="text-meta">{timeAgo(data.created_at)}</span>
          </div>
        </div>
        <StatusTag status={data.status} />
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
                  <div className="text-h3">{issueTypeConfig[data.issue_type]?.label}</div>
                  <div style={{ marginTop: 4 }}><SeverityTag severity={data.severity} /></div>
                </div>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: '0.87rem', lineHeight: 1.7, margin: 0 }}>{data.description}</p>
              {data.progress_percent > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-2)' }}>Repair progress</span><span style={{ fontWeight: 700 }}>{data.progress_percent}%</span>
                  </div>
                  <Meter value={data.progress_percent} showLabel={false} />
                </div>
              )}
            </div>
          </Panel>

          <Panel variant="bordered">
            <PanelHeader title="Status History" />
            <div className="panel-body">
              <div className="timeline">
                {data.history?.map((h: any, i: number) => (
                  <div key={h.id} className="timeline-item">
                    <span className={`timeline-dot ${i === data.history.length - 1 ? '' : 'is-muted'}`} />
                    <div style={{ fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{h.new_status?.replace(/_/g, ' ')}</span>
                      {h.notes && <span style={{ color: 'var(--text-2)' }}> — {h.notes}</span>}
                      <div className="text-meta" style={{ marginTop: 2 }}>by {h.changed_by_name} · {formatDateTime(h.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {(data.inspections?.length > 0 || isInspector || isAdmin) && (
            <Panel variant="bordered">
              <PanelHeader title={`Inspector Findings${data.inspections?.length ? ` (${data.inspections.length})` : ''}`} />
              <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.inspections?.map((ins: any) => (
                  <div key={ins.id} style={{ padding: 12, background: 'var(--n-25)', borderRadius: 'var(--r-tight)', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{ins.inspector_name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {ins.verified && <span className="tag tag-success">Verified</span>}
                        <span className="text-meta">{timeAgo(ins.inspection_date)}</span>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: 'var(--text-1)', lineHeight: 1.6 }}>{ins.findings}</p>
                    {ins.recommendation && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>
                        <span style={{ fontWeight: 600 }}>Recommendation: </span>{ins.recommendation}
                      </div>
                    )}
                  </div>
                ))}

                {(isInspector || isAdmin) && (
                  <div style={{ paddingTop: data.inspections?.length ? 4 : 0, borderTop: data.inspections?.length ? '1px solid var(--line)' : 'none' }}>
                    <div className="field">
                      <label className="field-label">Findings</label>
                      <textarea className="input" rows={3} value={findings} onChange={e => setFindings(e.target.value)} placeholder="What did you observe on-site? Measurements, severity, contributing factors…" />
                    </div>
                    <div className="field">
                      <label className="field-label">Recommendation (optional)</label>
                      <textarea className="input" rows={2} value={recommendation} onChange={e => setRecommendation(e.target.value)} placeholder="What repair approach do you recommend?" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.83rem', marginBottom: 10, cursor: 'pointer' }}>
                      <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />
                      Confirm this report as verified
                    </label>
                    <button
                      onClick={() => inspectionMutation.mutate()}
                      disabled={inspectionMutation.isPending || !findings.trim()}
                      className="btn btn-cta"
                    >
                      {inspectionMutation.isPending ? 'Saving…' : 'Record Findings'}
                    </button>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {data.attachments?.length > 0 && (
            <Panel variant="bordered">
              <PanelHeader title={`Attachments (${data.attachments.length})`} />
              <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {data.attachments.map((att: any) => (
                  <AttachmentThumb key={att.id} filePath={att.file_path} fileName={att.file_name} mimeType={att.mime_type} />
                ))}
              </div>
            </Panel>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel variant="bordered">
            <PanelHeader title="Details" />
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              {[
                { Icon: User, label: 'Reported by', value: data.reporter_name },
                { Icon: MapPin, label: 'Location', value: data.region_name, sub: data.address },
                { Icon: Calendar, label: 'Submitted', value: formatDateTime(data.created_at) },
                ...(data.resolved_at ? [{ Icon: CheckCircle, label: 'Resolved', value: formatDateTime(data.resolved_at) }] : []),
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
              {data.latitude && data.longitude && (
                <a href={`https://maps.google.com/?q=${data.latitude},${data.longitude}`} target="_blank" rel="noreferrer" className="btn-link" style={{ fontSize: '0.78rem' }}>
                  View on Google Maps →
                </a>
              )}
            </div>
          </Panel>

          {isStaff && data.status !== 'completed' && data.status !== 'rejected' && (
            <Panel variant="bordered">
              <PanelHeader title="Update Status" />
              <div className="panel-body">
                <textarea value={statusNote} onChange={e => setStatusNote(e.target.value)} rows={2} className="input" style={{ marginBottom: 10 }} placeholder="Add a note (optional)…" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {STATUS_FLOW.filter((_, i) => i > currentIdx).map(s => (
                    <button key={s} onClick={() => statusMutation.mutate({ status: s, notes: statusNote })} className="btn-std" style={{ justifyContent: 'flex-start' }}>
                      Mark as {statusConfig[s].label}
                    </button>
                  ))}
                  {isAdmin && (
                    <button onClick={() => statusMutation.mutate({ status: 'rejected', notes: statusNote })} className="btn-danger">Reject report</button>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 840px) { .detail-split { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
