import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const RESEND_COOLDOWN_SEC = 60;

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');

  const handleDigitChange = (i: number, value: string) => {
    const v = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setDigits(pasted.padEnd(6, '').split('').slice(0, 6));
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-email', { email, code });
      setSession(data.token, data.user);
      toast.success('Email verified — welcome to RoadSafe Namibia!');
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.data?.alreadyVerified) {
        toast('This account is already verified — please log in.', { icon: 'ℹ️' });
        navigate('/login');
        return;
      }
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
      setDigits(Array(6).fill(''));
      inputsRef.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await api.post('/auth/resend-verification', { email });
      toast.success('A new code is on its way.');
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err: any) {
      // The endpoint itself rate-limits with a specific wait time -- surface that if present.
      const msg = err.response?.data?.message;
      setError(msg || 'Could not resend code. Try again shortly.');
      const match = msg?.match(/(\d+)s/);
      if (match) setCooldown(parseInt(match[1]));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--n-25)', padding: '40px 24px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: '0.82rem', marginBottom: 24, textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--secondary-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Mail size={24} style={{ color: 'var(--secondary)' }} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: '0 0 6px' }}>Check your email</h2>
        <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', margin: '0 0 28px', lineHeight: 1.6 }}>
          We sent a 6-digit code to <strong>{email || 'your email address'}</strong>. Enter it below — it expires in 10 minutes.
        </p>

        {error && (
          <div className="notice notice-error" style={{ marginBottom: 18 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div onPaste={handlePaste} style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'space-between' }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => { inputsRef.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="input"
                style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 700, width: 44, height: 52, padding: 0 }}
                autoFocus={i === 0}
              />
            ))}
          </div>

          <button type="submit" disabled={loading || code.length !== 6} className="btn btn-cta btn-block btn-lg">
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.875rem', color: 'var(--text-2)' }}>
          Didn't get a code?{' '}
          {cooldown > 0
            ? <span style={{ color: 'var(--text-3)' }}>Resend in {cooldown}s</span>
            : <button type="button" onClick={handleResend} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--secondary)', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit' }}>Resend code</button>}
        </p>
      </div>
    </div>
  );
}
