import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, X, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { useRegions } from '../hooks/useRegions';
import { RFALogo } from '../components/common';
import { timeAgo, statusConfig, issueTypeConfig } from '../utils/helpers';

let L: any;
const sevColor: Record<string, string> = { low: '#3C5E78', medium: '#A8762E', high: '#8A4A1E', critical: '#963B3B' };

interface MapReport {
  id: number;
  report_number: string;
  issue_type: string;
  severity: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
  region_name: string;
}

export default function PublicMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selected, setSelected] = useState<MapReport | null>(null);
  const [filters, setFilters] = useState({ severity: '', status: '', region_id: '' });

  const { data: reports, isFetching, refetch } = useQuery<MapReport[]>({
    queryKey: ['public-map', filters],
    queryFn: async () => {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
      return (await api.get(`/public/map?${params}`)).data.data;
    },
    refetchInterval: 60_000, // a public live map should actually stay live
  });
  const { data: regions } = useRegions();

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      if (cancelled || !mapRef.current) return;
      L = mod;
      leafletMap.current = L.map(mapRef.current, { center: [-22.5597, 17.0832], zoom: 6, zoomControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(leafletMap.current);
      L.control.zoom({ position: 'bottomright' }).addTo(leafletMap.current);
      markersLayer.current = L.layerGroup().addTo(leafletMap.current);
      requestAnimationFrame(() => leafletMap.current?.invalidateSize());
      setMapReady(true);
    })();
    return () => {
      cancelled = true;
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !markersLayer.current || !L) return;
    markersLayer.current.clearLayers();
    (reports || []).forEach(report => {
      const color = sevColor[report.severity] || '#807C73';
      const marker = L.marker([report.latitude, report.longitude], {
        icon: L.divIcon({ html: `<div style="width:14px;height:14px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(19,27,36,0.4)"></div>`, className: '', iconSize: [14, 14], iconAnchor: [7, 7] }),
      });
      marker.on('click', () => setSelected(report));
      markersLayer.current.addLayer(marker);
    });
  }, [reports, mapReady]);

  return (
    <div style={{ background: 'var(--bg-panel)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass-light" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', flexShrink: 0 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RFALogo size={38}/>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--primary)', lineHeight: 1.2 }}>RoadSafe Namibia</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-2)' }}>An official RFA platform</div>
            </div>
          </Link>
          <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/impact" style={{ padding: '9px 16px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-2)' }}>Our Impact</Link>
            <Link to="/login" style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--line)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)', background: 'transparent' }}>Sign In</Link>
            <Link to="/register" className="btn btn-cta">Get Started <ChevronRight size={15}/></Link>
          </nav>
        </div>
      </header>

      <div style={{ padding: '28px 24px 12px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 6px' }}>Live Road Reports</h1>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', margin: 0 }}>
          Every active report across Namibia, updated automatically. Locations are shown approximately to protect reporter privacy.
        </p>
      </div>

      <div style={{ flex: 1, padding: '16px 24px 24px', maxWidth: 1280, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          <select value={filters.severity} onChange={e => setFilters(f => ({ ...f, severity: e.target.value }))} className="input input-sm" style={{ width: 'auto' }}>
            <option value="">All severities</option>{['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} className="input input-sm" style={{ width: 'auto' }}>
            <option value="">All statuses</option>{['reported', 'under_review', 'verified', 'assigned', 'in_progress', 'completed'].map(s => <option key={s} value={s}>{statusConfig[s as keyof typeof statusConfig]?.label}</option>)}
          </select>
          <select value={filters.region_id} onChange={e => setFilters(f => ({ ...f, region_id: e.target.value }))} className="input input-sm" style={{ width: 'auto' }}>
            <option value="">All regions</option>{(regions || []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={() => refetch()} className="btn-icon" style={{ marginLeft: 'auto' }}><RefreshCw size={14} className={isFetching ? 'skel' : ''} /></button>
          <span className="text-meta">{reports?.length ?? 0} active reports</span>
        </div>

        <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 480 }}>
          <div ref={mapRef} className="panel-bordered" style={{ flex: 1, overflow: 'hidden' }} />

          {selected ? (
            <div className="panel-bordered" style={{ width: 280, flexShrink: 0, overflowY: 'auto' }}>
              <div className="panel-header">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{issueTypeConfig[selected.issue_type as keyof typeof issueTypeConfig]?.label}</div>
                  <div className="text-mono" style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{selected.report_number}</div>
                </div>
                <button onClick={() => setSelected(null)} className="btn-icon"><X size={14} /></button>
              </div>
              <div className="panel-body">
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  <span className={`tag ${sevTag(selected.severity)}`}>{selected.severity}</span>
                  <span className={`tag ${statusConfig[selected.status as keyof typeof statusConfig]?.tag}`}>{statusConfig[selected.status as keyof typeof statusConfig]?.label}</span>
                </div>
                {[['Region', selected.region_name], ['Reported', timeAgo(selected.created_at)]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', gap: 8, fontSize: '0.8rem', marginBottom: 7 }}>
                    <span style={{ width: 60, color: 'var(--text-3)' }}>{l}</span><span>{v}</span>
                  </div>
                ))}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 12, lineHeight: 1.6 }}>
                  Sign in to see full report details, photos, and status history.
                </p>
              </div>
            </div>
          ) : (
            <div className="panel-bordered" style={{ width: 280, flexShrink: 0, padding: 18 }}>
              <div className="text-label" style={{ marginBottom: 12 }}>Severity</div>
              {Object.entries(sevColor).map(([sev, color]) => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-2)', textTransform: 'capitalize' }}>{sev}</span>
                </div>
              ))}
              <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 16, lineHeight: 1.6 }}>
                Click any marker to see basic details about that report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function sevTag(sev: string) {
  return { low: 'tag-neutral', medium: 'tag-warning', high: 'tag-warning', critical: 'tag-error' }[sev] || 'tag-neutral';
}
