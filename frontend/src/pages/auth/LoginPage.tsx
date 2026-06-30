import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { RFALogo } from '../../components/common';
import { HeroSlideshow, SlideImage } from '../../components/common/HeroSlideshow';

const PANEL_PHOTOS: SlideImage[] = [
  { url: 'https://images.unsplash.com/photo-1610477865545-37711c53144d?auto=format&fit=crop&w=900&q=80', credit: 'Zizi zi' },
  { url: 'https://images.unsplash.com/photo-1593436878048-92622a77d315?auto=format&fit=crop&w=900&q=80', credit: 'Mika Baumeister' },
  { url: 'https://images.unsplash.com/photo-1706712637075-f47fb47548f2?auto=format&fit=crop&w=900&q=80', credit: 'Tom Shamberger' },
  { url: 'https://images.unsplash.com/photo-1529792083865-d23889753466?auto=format&fit=crop&w=900&q=80', credit: 'Nicolas J Leclercq' },
];

const demos = [
  { label: 'Admin',     email: 'admin@roadfund.na',    color: '#28384A' },
  { label: 'Inspector', email: 'inspector@roadfund.na', color: '#3C7A5C' },
  { label: 'Officer',   email: 'officer@roadfund.na',   color: '#3182ce' },
  { label: 'Citizen',   email: 'citizen@roadfund.na',   color: '#64738a' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  // Demo-account shortcuts are for internal testing, not something a
  // real visitor to a government platform's login page should see --
  // only render them when explicitly asked for via ?demo=true.
  const showDemos = searchParams.get('demo') === 'true';
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => (await api.get('/public/stats')).data.data,
    staleTime: 1000 * 60 * 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(form.email, form.password); toast.success('Welcome back!'); navigate('/dashboard'); }
    catch (err: any) {
      if (err.response?.data?.requiresVerification) {
        toast('Please verify your email to continue', { icon: '📧' });
        navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email)}`);
        return;
      }
      setError(err.response?.data?.message || 'Invalid email or password.');
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--n-25)' }}>

      {/* Left panel — brand */}
      <div style={{
        width:'45%', background:'var(--primary)',
        display:'flex', flexDirection:'column',
        padding:'48px', position:'relative', overflow:'hidden',
      }} className="login-brand-panel">
        <HeroSlideshow images={PANEL_PHOTOS} intervalMs={6500} />

        <div style={{ position:'relative' }}>
          {/* Logo */}
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:12, marginBottom:64 }}>
            <RFALogo size={42}/>
            <div>
              <div style={{ color:'white', fontWeight:700, fontSize:'1rem', lineHeight:1.3 }}>RoadSafe Namibia</div>
              <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.75rem' }}>An official RFA platform</div>
            </div>
          </Link>

          <h1 style={{ color:'white', fontSize:'2rem', fontWeight:800, lineHeight:1.25, marginBottom:16, marginTop:0 }}>
            Namibia's Road<br />Maintenance Portal
          </h1>
          <p style={{ color:'rgba(255,255,255,0.78)', lineHeight:1.7, fontSize:'0.9rem', marginBottom:48, marginTop:0 }}>
            Report road defects, track repair progress, and help build a safer road network across all 14 regions of Namibia.
          </p>

          {/* Stats strip */}
          <div style={{ display:'flex', gap:32, flexWrap:'wrap', padding: '16px 20px', borderRadius: 12, background: 'rgba(15,21,28,0.72)', backdropFilter: 'blur(16px) saturate(140%)', WebkitBackdropFilter: 'blur(16px) saturate(140%)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {[
              [stats?.total_reports?.toLocaleString() ?? '—', 'Reports Processed'],
              [stats?.roads_repaired?.toLocaleString() ?? '—', 'Roads Repaired'],
              [stats?.regions ?? '—', 'Regions'],
            ].map(([v, l]) => (
              <div key={l}>
                <div style={{ color:'var(--secondary)', fontWeight:800, fontSize:'1.5rem', lineHeight:1 }}>{v}</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.75rem', marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stamp */}
        <div style={{ position:'relative', marginTop:'auto', paddingTop:32 }}>
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.12)', paddingTop:20 }}>
            <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'0.75rem', margin:0 }}>
              © 2026 RoadSafe Namibia
            </p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 32px' }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          <h2 style={{ fontSize:'1.625rem', fontWeight:800, color:'var(--primary)', margin:'0 0 4px' }}>Sign In</h2>
          <p style={{ color:'var(--text-2)', fontSize:'0.875rem', margin:'0 0 28px' }}>
            Enter your credentials to access your account
          </p>

          {/* Demo tiles — only when explicitly requested via ?demo=true */}
          {showDemos && (
            <div style={{ marginBottom:24 }}>
              <p style={{ fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-3)', marginBottom:10, marginTop:0 }}>
                Quick Demo Access
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {demos.map(({ label, email, color }) => (
                  <button key={label} type="button"
                    onClick={() => setForm({ email, password:'Password123!' })}
                    style={{
                      padding:'8px 12px', borderRadius:8, border:`1.5px solid ${color}25`,
                      background:`${color}08`, color, fontWeight:600, fontSize:'0.8rem',
                      cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = `${color}15`)}
                    onMouseOut={e  => (e.currentTarget.style.background = `${color}08`)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ height:1, background:'var(--line)', margin:'0 0 24px' }}/>

          {error && (
            <div className="notice notice-error" style={{ marginBottom:18 }}>
              <AlertCircle size={15} style={{ flexShrink:0 }}/> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label">Email Address</label>
              <div style={{ position:'relative' }}>
                <Mail size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--n-400)', pointerEvents:'none' }}/>
                <input type="email" value={form.email}
                  onChange={e => setForm({...form, email:e.target.value})}
                  className="input" style={{ paddingLeft:40 }}
                  placeholder="you@example.com" required />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={15} style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'var(--n-400)', pointerEvents:'none' }}/>
                <input type={showPw ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({...form, password:e.target.value})}
                  className="input" style={{ paddingLeft:40, paddingRight:40 }}
                  placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--n-400)', padding:0, display:'flex' }}>
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-cta btn-block btn-lg brand-glow" style={{ marginTop:8 }}>
              {loading
                ? <><span className="animate-spin" style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%' }}/> Signing in…</>
                : 'Sign In to RoadSafe Namibia'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:20, fontSize:'0.875rem', color:'var(--text-2)' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color:'var(--secondary)', fontWeight:600 }}>Register here</Link>
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-brand-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
