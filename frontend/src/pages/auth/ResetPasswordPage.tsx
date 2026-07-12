import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { RFALogo } from '../../components/common';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [form, setForm]       = useState({ new_password: '', confirm_password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  // Validation helpers
  const pwRules = [
    { label: 'At least 8 characters', ok: form.new_password.length >= 8 },
    { label: 'One uppercase letter',  ok: /[A-Z]/.test(form.new_password) },
    { label: 'One lowercase letter',  ok: /[a-z]/.test(form.new_password) },
    { label: 'One number',            ok: /[0-9]/.test(form.new_password) },
  ];
  const pwValid   = pwRules.every(r => r.ok);
  const pwMatch   = form.new_password === form.confirm_password && form.confirm_password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pwValid) { setError('Please meet all password requirements.'); return; }
    if (!pwMatch) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, token, new_password: form.new_password });
      setDone(true);
      toast.success('Password reset successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  // Missing token/email — show an error straight away
  if (!token || !email) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--n-25)', padding: 24 }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div className="notice notice-error" style={{ marginBottom: 20 }}>
            <AlertCircle size={15} /> Invalid or incomplete reset link.
          </div>
          <Link to="/forgot-password" style={{ color: 'var(--secondary)', fontWeight: 600 }}>Request a new reset link →</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--n-25)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36, textDecoration: 'none' }}>
          <RFALogo size={36} />
          <div>
            <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>RoadSafe Namibia</div>
            <div style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>An official RFA platform</div>
          </div>
        </Link>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '36px 32px' }}>
          {done ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, background: 'var(--secondary-10, #ecfdf5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={28} style={{ color: 'var(--secondary)' }} />
                </div>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 8px' }}>Password updated!</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 24px' }}>
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button
                type="button"
                className="btn btn-cta btn-block"
                onClick={() => navigate('/login')}
              >
                Go to Sign In
              </button>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 6px' }}>Set new password</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', margin: '0 0 24px', lineHeight: 1.55 }}>
                Choose a strong password for <strong>{email}</strong>.
              </p>

              {error && (
                <div className="notice notice-error" style={{ marginBottom: 18 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {/* New password */}
                <div className="field">
                  <label className="field-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--n-400)', pointerEvents: 'none' }} />
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={form.new_password}
                      onChange={e => setForm({ ...form, new_password: e.target.value })}
                      className="input"
                      style={{ paddingLeft: 40, paddingRight: 40 }}
                      placeholder="••••••••"
                      required
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n-400)', padding: 0, display: 'flex' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password strength checklist */}
                  {form.new_password.length > 0 && (
                    <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {pwRules.map(rule => (
                        <li key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: rule.ok ? 'var(--secondary)' : 'var(--text-3)' }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: rule.ok ? 'var(--secondary)' : 'var(--n-200)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {rule.ok && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </span>
                          {rule.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Confirm password */}
                <div className="field">
                  <label className="field-label">Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--n-400)', pointerEvents: 'none' }} />
                    <input
                      type={showCPw ? 'text' : 'password'}
                      value={form.confirm_password}
                      onChange={e => setForm({ ...form, confirm_password: e.target.value })}
                      className="input"
                      style={{ paddingLeft: 40, paddingRight: 40, borderColor: form.confirm_password.length > 0 && !pwMatch ? 'var(--danger, #dc2626)' : undefined }}
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" onClick={() => setShowCPw(!showCPw)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n-400)', padding: 0, display: 'flex' }}>
                      {showCPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.confirm_password.length > 0 && !pwMatch && (
                    <p style={{ color: 'var(--danger, #dc2626)', fontSize: '0.78rem', margin: '6px 0 0' }}>Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !pwValid || !pwMatch}
                  className="btn btn-cta btn-block btn-lg brand-glow"
                  style={{ marginTop: 8 }}
                >
                  {loading
                    ? <><span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> Resetting…</>
                    : 'Reset Password'}
                </button>
              </form>

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: '0.875rem', textDecoration: 'none', fontWeight: 500 }}>
                  <ArrowLeft size={15} /> Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
