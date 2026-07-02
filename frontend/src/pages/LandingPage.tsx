import { Link } from 'react-router-dom'; 
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { HeroSlideshow, SlideImage } from '../components/common/HeroSlideshow';
import { RFALogo } from '../components/common';
import {
  ChevronRight, ArrowRight, MapPin, BarChart3, Shield,
  CheckCircle, Globe, HardHat, Phone, AlertTriangle,
  Zap, Construction, Navigation, Layers,
} from 'lucide-react';

// Free-license (Unsplash License, not Unsplash+) road/construction
// photos -- not sourced from generic image search, since there's no
// way to verify licensing on arbitrary search-result images, and
// these are baked into a live public site. Attribution shown in the
// slideshow itself even though Unsplash doesn't require it.
const HERO_PHOTOS: SlideImage[] = [
  { url: 'https://images.unsplash.com/photo-1503708928676-1cb796a0891e?auto=format&fit=crop&w=1600&q=80', credit: 'Jamar Penny' },
  { url: 'https://images.unsplash.com/photo-1517089596392-fb9a9033e05b?auto=format&fit=crop&w=1600&q=80', credit: 'Shane McLendon' },
  { url: 'https://images.unsplash.com/photo-1529792083865-d23889753466?auto=format&fit=crop&w=1600&q=80', credit: 'Nicolas J Leclercq' },
  { url: 'https://images.unsplash.com/photo-1583024011792-b165975b52f5?auto=format&fit=crop&w=1600&q=80', credit: 'EESOFUFFZICH' },
  { url: 'https://images.unsplash.com/photo-1504930268766-d71549a36ec2?auto=format&fit=crop&w=1600&q=80', credit: 'Jamie Street' },
  { url: 'https://images.unsplash.com/photo-1706712637075-f47fb47548f2?auto=format&fit=crop&w=1600&q=80', credit: 'Tom Shamberger' },
  { url: 'https://images.unsplash.com/photo-1534097575056-ddba81f714c8?auto=format&fit=crop&w=1600&q=80', credit: 'Brandon Mowinkel' },
  { url: 'https://images.unsplash.com/photo-1593436878048-92622a77d315?auto=format&fit=crop&w=1600&q=80', credit: 'Mika Baumeister' },
  { url: 'https://images.unsplash.com/photo-1603814929877-d5d927322656?auto=format&fit=crop&w=1600&q=80', credit: 'Jason Jarrach' },
  { url: 'https://images.unsplash.com/photo-1610477865545-37711c53144d?auto=format&fit=crop&w=1600&q=80', credit: 'Zizi zi' },
];

// Icon + color + display label per issue type — this part is genuine
// design/categorization and stays fixed. Only the count is real data,
// fetched from /public/stats below.
const ISSUE_META: Record<string, { icon: any; label: string; color: string }> = {
  pothole:              { icon: AlertTriangle, label: 'Potholes',             color: '#dc2626' },
  damaged_sign:         { icon: Construction,  label: 'Damaged Signs',        color: '#d97706' },
  broken_traffic_light: { icon: Zap,           label: 'Traffic Light Faults', color: '#ca8a04' },
  flooded_road:         { icon: Navigation,    label: 'Flooded Roads',        color: '#2563eb' },
  cracked_road:         { icon: Layers,        label: 'Cracked Surfaces',     color: '#7c3aed' },
  road_blockage:        { icon: AlertTriangle, label: 'Road Blockages',       color: '#3C7A5C' },
  other:                { icon: AlertTriangle, label: 'Other Issues',         color: '#64748b' },
};

const SERVICES = [
  { icon: MapPin,       title: 'Precise Reporting',    desc: 'Submit reports with GPS pin accuracy, photos and full issue details in under 2 minutes.', accent: 'var(--secondary)' },
  { icon: BarChart3,    title: 'Real-Time Tracking',   desc: 'Monitor every report from submission through completion with live status updates.', accent: 'var(--primary)' },
  { icon: Shield,       title: 'Secure & Accountable', desc: 'Role-based access ensures the right people manage the right tasks at every level.', accent: 'var(--secondary)' },
  { icon: HardHat,      title: 'Field Coordination',   desc: 'Maintenance teams receive assignments and update field progress in real-time.', accent: 'var(--primary)' },
  { icon: CheckCircle,  title: 'Inspector Verification',desc: 'Every report is validated by a qualified field inspector before repair work begins.', accent: 'var(--secondary)' },
  { icon: Globe,        title: 'All 14 Regions',       desc: 'Full national coverage from Kavango East to Karas, Erongo to Zambezi.', accent: 'var(--primary)' },
];



export default function LandingPage() {
  // Public, unauthenticated -- real counts from the live database,
  // not hardcoded marketing numbers.
  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => (await api.get('/public/stats')).data.data,
    staleTime: 1000 * 60 * 5,
  });

  const issueRows = (stats?.by_issue_type || [])
    .filter((r: any) => ISSUE_META[r.issue_type])
    .sort((a: any, b: any) => b.count - a.count)
    .map((r: any) => ({ ...ISSUE_META[r.issue_type], count: r.count }));

  return (
    <div style={{ background: 'var(--bg-panel)', color: 'var(--primary)' }}>

      {/* ── Utility bar ─────────────────────────────────────── */}
      <div style={{ background: 'var(--primary)', padding: '7px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
          <span>RoadSafe Namibia — an official Road Fund Administration (RFA) platform</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={11}/> Toll-Free: 0800 433 300
          </span>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────── */}
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
            <Link to="/impact" style={{ padding: '9px 16px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-2)' }}>
              Our Impact
            </Link>
            <Link to="/login"
              style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--line)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)', background: 'transparent' }}>
              Sign In
            </Link>
            <Link to="/register" className="btn btn-cta">
              Get Started <ChevronRight size={15}/>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section style={{ background: 'var(--primary)', padding: '80px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <HeroSlideshow images={HERO_PHOTOS} />
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 420px', gap: 64, alignItems: 'center', position: 'relative', zIndex: 1 }}>

          {/* Copy */}
          <div>
            <h1 style={{ color: 'white', fontSize: '2.75rem', fontWeight: 800, lineHeight: 1.15, margin: '0 0 20px', letterSpacing: '-0.025em' }}>
              Funding &amp; Maintaining<br/>
              <span style={{ color: 'var(--secondary)' }}>Namibia's Roads</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '1rem', lineHeight: 1.75, margin: '0 0 36px', maxWidth: 500 }}>
              Report road defects, monitor maintenance progress, and help keep Namibia's 48,754 km national road network safe — all in one government-grade platform.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link to="/register" className="btn btn-cta btn-lg brand-glow">
                Report a Road Issue <ArrowRight size={17}/>
              </Link>
              <Link to="/login" style={{ padding: '13px 24px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.82)', fontWeight: 600, fontSize: '1rem', background: 'transparent', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Staff Portal
              </Link>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 36, marginTop: 40, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
              {[
                [stats?.total_reports?.toLocaleString() ?? '—', 'Reports Processed'],
                [stats?.roads_repaired?.toLocaleString() ?? '—', 'Roads Repaired'],
                [stats?.regions ?? '—', 'Regions'],
              ].map(([v, l]) => (
                <div key={l}>
                  <div style={{ color: 'var(--secondary)', fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>{v}</div>
                  <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.75rem', marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Issue type breakdown — proportional bars, one accent
              color throughout. (Previously: a stack of identically-
              shaped cards each in a different random accent color
              with a circular count badge — reads as templated rather
              than as actual data.) */}
          <div style={{ background: 'rgba(15,21,28,0.72)', backdropFilter: 'blur(16px) saturate(140%)', WebkitBackdropFilter: 'blur(16px) saturate(140%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
              Common Issue Types
            </div>
            {issueRows.map(({ icon: Icon, label, count }: any, i: number) => (
              <div key={label} style={{ marginBottom: i < issueRows.length - 1 ? 13 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                  <Icon size={13} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}/>
                  <span style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 500, fontSize: '0.82rem', flex: 1 }}>{label}</span>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>{count.toLocaleString()}</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.13)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / (issueRows[0]?.count || 1)) * 100}%`, background: 'var(--secondary)', borderRadius: 3 }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', background: 'var(--n-25)' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 12px', letterSpacing: '-0.015em' }}>
              A Complete Road Management Platform
            </h2>
            <p style={{ color: 'var(--text-2)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7, fontSize: '0.95rem' }}>
              Connecting citizens, inspectors, maintenance officers and administrators in one unified system.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {SERVICES.map(({ icon: Icon, title, desc, accent }) => (
              <div key={title} className="panel-bordered" style={{ padding: '24px 22px' }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: accent === 'var(--secondary)' ? 'var(--secondary-100)' : 'var(--primary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={22} style={{ color: accent }}/>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 8, fontSize: '0.95rem' }}>{title}</div>
                <p style={{ color: 'var(--text-2)', fontSize: '0.85rem', lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section style={{ padding: '72px 24px', background: 'var(--bg-panel)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 48px', letterSpacing: '-0.015em' }}>
            How It Works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40 }}>
            {[
              { n: '01', title: 'Report',  desc: 'Spot a defect? Submit in under 2 minutes with your location, photos and issue type.', color: 'var(--secondary)' },
              { n: '02', title: 'Inspect', desc: 'A field inspector verifies the report, classifies severity and assigns a maintenance team.', color: 'var(--primary)' },
              { n: '03', title: 'Repair',  desc: 'The maintenance team fixes the issue and marks it complete. You receive a notification.', color: 'var(--secondary)' },
            ].map(({ n, title, desc, color }) => (
              <div key={n}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.1rem', margin: '0 auto 20px' }}>{n}</div>
                <h3 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 10, fontSize: '1.05rem', marginTop: 0 }}>{title}</h3>
                <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', lineHeight: 1.7, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section style={{ background: 'var(--primary)', padding: '72px 24px', position: 'relative', overflow: 'hidden' }}>
        <HeroSlideshow images={[...HERO_PHOTOS].reverse()} intervalMs={6000} />
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 style={{ color: 'white', fontSize: '2rem', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.015em' }}>
            See a Road Problem?{' '}
            <span style={{ color: 'var(--secondary)' }}>Report It Now.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.975rem', margin: '0 0 32px', lineHeight: 1.75 }}>
            Join thousands of Namibians helping build safer, better roads. Your report reaches the right team immediately.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-cta btn-lg">
              Create Free Account <ArrowRight size={17}/>
            </Link>
            <Link to="/login" style={{ padding: '13px 24px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.82)', fontWeight: 600, fontSize: '1rem', background: 'transparent', display: 'inline-flex', alignItems: 'center' }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer style={{ background: 'var(--n-25)', borderTop: '1px solid var(--line)', padding: '48px 24px 28px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 48, marginBottom: 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <RFALogo size={36}/>
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>RoadSafe Namibia</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>An official RFA platform</div>
                </div>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: '0.825rem', lineHeight: 1.7, maxWidth: 300, margin: '0 0 14px' }}>
                Shaping a sustainable, world-class transport sector for the people of Namibia.
              </p>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.8 }}>
                21 Sir Seretse Khama Street, Windhoek<br/>
                Toll-Free: 0800 433 300
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 14, fontSize: '0.875rem' }}>Platform</div>
              {['Report Issue', 'Track Reports', 'Live Map', 'Analytics'].map(l => (
                <div key={l} style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 9 }}>{l}</div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 14, fontSize: '0.875rem' }}>RFA Official</div>
              {[['rfanam.com.na', 'https://rfanam.com.na'], ['Online Payments', 'https://online.rfanam.com.na'], ['Privacy Policy', '#'], ['Contact Us', '#']].map(([l, h]) => (
                <a key={l} href={h} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 9, textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
              &copy; 2026 RoadSafe Namibia. All rights reserved.
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--secondary)', fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary)', display: 'inline-block' }}/>
              System Operational
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          section > div > div[style*="grid-template-columns: 1fr 420px"] { grid-template-columns: 1fr !important; }
          section > div > div[style*="repeat(3, 1fr)"] { grid-template-columns: 1fr 1fr !important; }
          footer > div > div[style*="2fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          section > div > div[style*="repeat(3, 1fr)"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
