import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Mail, Lock, Phone, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { RFALogo } from '../../components/common';
import { HeroSlideshow, SlideImage } from '../../components/common/HeroSlideshow';

const PANEL_PHOTOS: SlideImage[] = [
  { url: 'https://images.unsplash.com/photo-1517089596392-fb9a9033e05b?auto=format&fit=crop&w=900&q=80', credit: 'Shane McLendon' },
  { url: 'https://images.unsplash.com/photo-1583024011792-b165975b52f5?auto=format&fit=crop&w=900&q=80', credit: 'EESOFUFFZICH' },
  { url: 'https://images.unsplash.com/photo-1534097575056-ddba81f714c8?auto=format&fit=crop&w=900&q=80', credit: 'Brandon Mowinkel' },
  { url: 'https://images.unsplash.com/photo-1603814929877-d5d927322656?auto=format&fit=crop&w=900&q=80', credit: 'Jason Jarrach' },
];

const Field = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
  <div className="field">
    <label className="field-label">{label}</label>
    <div style={{ position: 'relative' }}>
      <Icon size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--n-400)', pointerEvents: 'none', zIndex: 1 }} />
      {children}
    </div>
  </div>
);

export default function RegisterPage() {
  const navigate   = useNavigate();
  const [form,    setForm]    = useState({ full_name: '', email: '', password: '', phone: '' });
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('Account created — check your email for a verification code.');
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--n-25)' }}>

      {/* Left brand panel */}
      <div style={{ width: '42%', background: 'var(--primary)', display: 'flex', flexDirection: 'column', padding: '48px', position: 'relative', overflow: 'hidden' }} className="register-brand-panel">
        <HeroSlideshow images={PANEL_PHOTOS} intervalMs={6500} />
        <div style={{ position: 'relative' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 64 }}>
            <RFALogo size={38}/>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.25 }}>RoadSafe Namibia</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>An official RFA platform</div>
            </div>
          </Link>
          <h1 style={{ color: 'white', fontSize: '1.875rem', fontWeight: 800, lineHeight: 1.2, margin: '0 0 16px' }}>
            Join the RFA<br/>Community
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.75, fontSize: '0.9rem', margin: '0 0 40px' }}>
            Help improve Namibia's road network by reporting defects directly through RoadSafe Namibia, the Road Fund Administration's citizen reporting platform.
          </p>
          <div style={{ padding: '18px 20px', borderRadius: 12, background: 'rgba(15,21,28,0.72)', backdropFilter: 'blur(16px) saturate(140%)', WebkitBackdropFilter: 'blur(16px) saturate(140%)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {['Free to register and use', 'Reports reach the right team instantly', 'Track your report status in real-time', 'Available across all 14 regions'].map((item, i, arr) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < arr.length - 1 ? 12 : 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 20 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', margin: 0 }}>
            © 2025 RoadSafe Namibia · Operated by the RFA
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 4px' }}>Create Account</h2>
          <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', margin: '0 0 28px' }}>Fill in the details below to get started.</p>

          {error && (
            <div className="notice notice-error" style={{ marginBottom: 20 }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }}/> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Field icon={User} label="Full Name">
              <input type="text" value={form.full_name} onChange={set('full_name')}
                className="input" style={{ paddingLeft: 38 }}
                placeholder="Your full name" required />
            </Field>

            <Field icon={Mail} label="Email Address">
              <input type="email" value={form.email} onChange={set('email')}
                className="input" style={{ paddingLeft: 38 }}
                placeholder="you@example.com" required />
            </Field>

            <Field icon={Phone} label="Phone Number (optional)">
              <input type="tel" value={form.phone} onChange={set('phone')}
                className="input" style={{ paddingLeft: 38 }}
                placeholder="+264 81 000 0000" />
            </Field>

            <div className="field">
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--n-400)', pointerEvents: 'none' }}/>
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  className="input" style={{ paddingLeft: 38, paddingRight: 40 }}
                  placeholder="Min. 6 characters" required minLength={6} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n-400)', padding: 0, display: 'flex' }}>
                  {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-cta btn-block btn-lg" style={{ marginTop: 8 }}>
              {loading
                ? <><span className="spin" style={{ display:'inline-block', width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%' }}/> Creating account…</>
                : 'Create Account'}
            </button>
          </form>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center', margin: '16px 0 0' }}>
            By registering you agree to our Terms of Use and Privacy Policy.
          </p>
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-2)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--secondary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>

      <style>{`@media (max-width: 768px) { .register-brand-panel { display: none !important; } }`}</style>
    </div>
  );
}
