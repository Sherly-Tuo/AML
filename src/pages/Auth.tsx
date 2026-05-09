import { ArrowLeft, LoaderCircle, Mail, Phone, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

type Mode = 'email' | 'phone-entry' | 'phone-otp';

function isRateLimitError(msg: string) {
  return /rate.?limit|too many|email.*limit/i.test(msg);
}

export default function Auth() {
  const { hasSupabaseConfig, loading, user, requestMagicLink, requestPhoneOtp, verifyPhoneOtp } =
    useAuth();

  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/experience" replace />;
  }

  /* ── Email submit ── */
  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!email.trim()) { setError('Enter an email address first.'); return; }
    setSubmitting(true);
    const result = await requestMagicLink(email.trim());
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      if (isRateLimitError(result.error)) setRateLimited(true);
      return;
    }
    setStatus(`Check ${email.trim()} for your sign-in link.`);
  };

  /* ── Phone: send OTP ── */
  const handlePhoneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatus('');
    const cleaned = phone.trim().replace(/\s+/g, '');
    if (!cleaned) { setError('Enter a phone number first.'); return; }
    setSubmitting(true);
    const result = await requestPhoneOtp(cleaned);
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    setMode('phone-otp');
    setStatus('Code sent — check your SMS.');
  };

  /* ── Phone: verify OTP ── */
  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!otp.trim()) { setError('Enter the 6-digit code from your SMS.'); return; }
    setSubmitting(true);
    const result = await verifyPhoneOtp(phone.trim().replace(/\s+/g, ''), otp.trim());
    setSubmitting(false);
    if (result.error) { setError(result.error); return; }
    // Auth state change handled by AuthProvider
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-4">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_20px_rgba(38,84,62,0.08)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
            Secure sign-in
          </span>
        </div>

        {/* Hero card */}
        <section className="rounded-[2.2rem] bg-emerald-950 px-5 py-6 text-white shadow-[0_24px_60px_rgba(16,24,20,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">VoltShare</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                {mode === 'email' ? 'Sign in with email' : mode === 'phone-entry' ? 'Sign in with phone' : 'Enter your code'}
              </h1>
              <p className="mt-3 max-w-[17rem] text-sm leading-6 text-emerald-50/80">
                {mode === 'email'
                  ? 'Get a secure sign-in link sent straight to your inbox.'
                  : mode === 'phone-entry'
                  ? 'We\'ll send a one-time code to your mobile number.'
                  : `Code sent to ${phone}. It expires in 60 seconds.`}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-3">
              {mode === 'email' ? (
                <ShieldCheck className="h-6 w-6 text-emerald-100" />
              ) : (
                <Phone className="h-6 w-6 text-emerald-100" />
              )}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <FeaturePill icon={Wallet} label="Save your runs" />
            <FeaturePill icon={Sparkles} label="Unlock account history" />
          </div>
        </section>

        {/* Form card */}
        <section className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)]">

          {/* Mode tabs */}
          <div className="flex gap-2 mb-5">
            <button
              type="button"
              onClick={() => { setMode('email'); setError(''); setStatus(''); }}
              className={`flex-1 rounded-[1.1rem] py-2.5 text-sm font-medium transition ${
                mode === 'email'
                  ? 'bg-emerald-950 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Mail className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
              Email
            </button>
            <button
              type="button"
              onClick={() => { setMode('phone-entry'); setError(''); setStatus(''); }}
              className={`flex-1 rounded-[1.1rem] py-2.5 text-sm font-medium transition ${
                mode === 'phone-entry' || mode === 'phone-otp'
                  ? 'bg-emerald-950 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Phone className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
              Phone
            </button>
          </div>

          {!hasSupabaseConfig && (
            <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50/85 px-4 py-4 text-sm leading-6 text-amber-950">
              Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code> to your local environment, then refresh.
            </div>
          )}

          {/* Rate limit nudge */}
          {rateLimited && mode === 'email' && (
            <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50/85 px-4 py-3 text-sm leading-6 text-amber-950">
              Email rate limit reached.{' '}
              <button
                type="button"
                className="font-semibold underline underline-offset-2 hover:text-amber-800"
                onClick={() => { setMode('phone-entry'); setError(''); setStatus(''); setRateLimited(false); }}
              >
                Try signing in with your phone instead →
              </button>
            </div>
          )}

          {/* ── Email form ── */}
          {mode === 'email' && (
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <label className="field-block">
                <span className="field-label">Email Address</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    className="input-control w-full pl-11"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!hasSupabaseConfig || submitting}
                  />
                </div>
              </label>
              <ErrorBanner msg={error} />
              <StatusBanner msg={status} />
              <button className="primary-btn w-full" type="submit" disabled={!hasSupabaseConfig || submitting}>
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {submitting ? 'Sending link…' : 'Send magic link'}
              </button>
            </form>
          )}

          {/* ── Phone entry form ── */}
          {mode === 'phone-entry' && (
            <form className="space-y-4" onSubmit={handlePhoneSubmit}>
              <label className="field-block">
                <span className="field-label">Mobile Number</span>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    className="input-control w-full pl-11"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+44 7700 900000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!hasSupabaseConfig || submitting}
                  />
                </div>
              </label>
              <p className="text-xs text-stone-400 leading-5">
                Include your country code, e.g. +44 for UK, +1 for US.
              </p>
              <ErrorBanner msg={error} />
              <StatusBanner msg={status} />
              <button className="primary-btn w-full" type="submit" disabled={!hasSupabaseConfig || submitting}>
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {submitting ? 'Sending code…' : 'Send SMS code'}
              </button>
            </form>
          )}

          {/* ── OTP verification form ── */}
          {mode === 'phone-otp' && (
            <form className="space-y-4" onSubmit={handleOtpSubmit}>
              <StatusBanner msg={status} />
              <label className="field-block">
                <span className="field-label">6-digit code</span>
                <input
                  className="input-control w-full text-center tracking-[0.4em] text-xl font-semibold"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="——————"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={submitting}
                  autoFocus
                />
              </label>
              <ErrorBanner msg={error} />
              <button className="primary-btn w-full" type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {submitting ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <button
                type="button"
                className="w-full text-sm text-stone-500 hover:text-stone-700 transition"
                onClick={() => { setMode('phone-entry'); setOtp(''); setError(''); setStatus(''); }}
              >
                ← Try a different number
              </button>
            </form>
          )}

          <div className="mt-5 rounded-[1.4rem] bg-stone-50/80 px-4 py-4 text-sm leading-6 text-stone-600">
            Guests can still explore VoltShare without signing in — it simply gives you a personal account layer for saved pricing history.
          </div>
        </section>
      </div>
    </main>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="rounded-[1.3rem] border border-rose-200 bg-rose-50/85 px-4 py-3 text-sm leading-6 text-rose-900">
      {msg}
    </div>
  );
}

function StatusBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div className="rounded-[1.3rem] border border-sky-200 bg-sky-50/85 px-4 py-3 text-sm leading-6 text-sky-950">
      {msg}
    </div>
  );
}

function FeaturePill({ icon: Icon, label }: { icon: typeof Wallet; label: string }) {
  return (
    <div className="rounded-[1.4rem] bg-white/10 px-4 py-3">
      <div className="flex items-center gap-2 text-emerald-100">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
