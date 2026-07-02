import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ArrowRight, MapPin, Calendar, Wallet, ImageOff } from 'lucide-react';
import api from '../utils/api';
import { RFALogo } from '../components/common';
import { formatDate, formatCurrency, issueTypeConfig } from '../utils/helpers';

interface ImpactItem {
  id: number;
  report_number: string;
  title: string;
  issue_type: string;
  severity: string;
  resolved_at: string;
  region_name: string;
  cost_estimate: number | null;
  actual_cost: number | null;
  before_photo: string;
  after_photo: string;
}

export default function ImpactPage() {
  const { data: items, isLoading } = useQuery<ImpactItem[]>({
    queryKey: ['public-impact'],
    queryFn: async () => (await api.get('/public/impact')).data.data,
  });

  return (
    <div style={{ background: 'var(--bg-panel)', minHeight: '100vh' }}>
      {/* ── Header (same brand treatment as the landing page) ─── */}
      <header className="glass-light" style={{ position: 'sticky', top: 0, zIndex: 40, borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RFALogo size={38}/>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--primary)', lineHeight: 1.2 }}>RoadSafe Namibia</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>An official RFA platform</div>
            </div>
          </Link>
          <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/map" style={{ padding: '9px 16px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-2)' }}>
              Live Map
            </Link>
            <Link to="/login" style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--line)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)', background: 'transparent' }}>
              Sign In
            </Link>
            <Link to="/register" className="btn btn-cta">
              Get Started <ChevronRight size={15}/>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Intro ──────────────────────────────────────────────── */}
      <section style={{ padding: '56px 24px 36px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, background: 'var(--secondary-100)', color: 'var(--secondary-700)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 16 }}>
          Public Accountability
        </span>
        <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
          Real Repairs. Real Results.
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '0.975rem', lineHeight: 1.7, margin: 0 }}>
          Every repair below was reported by a citizen, fixed by a maintenance crew, and documented with a real before-and-after photo — including what it actually cost. No estimates standing in for results.
        </p>
      </section>

      {/* ── Grid ───────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 72px', maxWidth: 1160, margin: '0 auto' }}>
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 320, borderRadius: 14, background: 'var(--n-50)' }} />)}
          </div>
        ) : !items?.length ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', border: '1.5px dashed var(--line-strong)', borderRadius: 16 }}>
            <ImageOff size={32} style={{ color: 'var(--text-3)', marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 8px', color: 'var(--primary)' }}>No documented repairs yet</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', maxWidth: 420, margin: '0 auto' }}>
              Once a maintenance crew completes a repair and uploads proof, it'll show up here — with the real cost, right next to the citizen's original report.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {items.map(item => (
              <div key={item.id} className="panel-bordered" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <PhotoSlot label="Before" filePath={item.before_photo} />
                  <PhotoSlot label="After" filePath={item.after_photo} />
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>{item.title}</span>
                    <span className="tag tag-success" style={{ flexShrink: 0 }}>Resolved</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: '0.76rem', marginBottom: 10 }}>
                    <MapPin size={11}/> {item.region_name}
                    <span style={{ margin: '0 2px' }}>·</span>
                    <Calendar size={11}/> {item.resolved_at ? formatDate(item.resolved_at) : '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                    <Wallet size={13} style={{ color: 'var(--secondary)' }}/>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                      Cost: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(item.actual_cost ?? item.cost_estimate)}</strong>
                      {item.actual_cost == null && item.cost_estimate != null && <span style={{ color: 'var(--text-3)' }}> (estimated)</span>}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--n-25)', borderTop: '1px solid var(--line)', padding: '48px 24px', textAlign: 'center' }}>
        <h3 style={{ color: 'var(--primary)', margin: '0 0 10px' }}>Seen a problem on your road?</h3>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', margin: '0 0 22px' }}>Report it, and we'll show the world when it's fixed.</p>
        <Link to="/register" className="btn btn-cta btn-lg">
          Report a Road Issue <ArrowRight size={17}/>
        </Link>
      </section>
    </div>
  );
}

// Photos on this page are served via the unauthenticated public route
// (only ever returns files attached to a completed report — see
// backend/controllers/publicController.js), so this can use a plain
// <img> directly rather than AttachmentThumb's authenticated-fetch
// approach, which is for in-dashboard viewing of possibly-private photos.
function PhotoSlot({ label, filePath }: { label: string; filePath: string | null }) {
  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
  const filename = filePath ? filePath.split('/').pop() : null;
  return (
    <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--n-100)' }}>
      {filename
        ? <img src={`${apiBase}/api/public/uploads/${filename}`} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageOff size={20} style={{ color: 'var(--text-3)' }} /></div>}
      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
    </div>
  );
}
