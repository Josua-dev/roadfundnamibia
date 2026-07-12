import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import { RFALogo } from '../../components/common';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response.data.message || 'Too many requests. Please wait a few minutes.');
      } else {
        setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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
          {sent ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, background: 'var(--secondary-10, #ecfdf5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={28} style={{ color: 'var(--secondary)' }} />
                </div>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 8px' }}>Check your inbox</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 24px' }}>
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. It expires in 30 minutes.
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: '0.8rem', margin: '0 0 24px' }}>
                Didn't receive it? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={() => { setSent(false); setError(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                >
                  try again
                </button>.
              </p>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
                <ArrowLeft size={15} /> Back to Sign In
              </Link>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 6px' }}>Forgot password?</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', margin: '0 0 24px', lineHeight: 1.55 }}>
                Enter the email address linked to your account and we'll send you a reset link.
              </p>

              {error && (
                <div className="notice notice-error" style={{ marginBottom: 18 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label className="field-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--n-400)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="input"
                      style={{ paddingLeft: 40 }}
                      placeholder="you@example.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn btn-cta btn-block btn-lg brand-glow" style={{ marginTop: 8 }}>
                  {loading
                    ? <><span className="animate-spin" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> Sending…</>
                    : 'Send Reset Link'}
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
