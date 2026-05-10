import { ArrowLeft, LoaderCircle, Lock, Mail, ShieldCheck, Sparkles, UserRound, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';

type Mode = 'sign-in' | 'sign-up' | 'forgot' | 'reset';

function getRecoveryMode(): Mode | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = `${window.location.hash}${window.location.search}`.toLowerCase();
  return raw.includes('type=recovery') ? 'reset' : null;
}

export default function Auth() {
  const {
    hasSupabaseConfig,
    user,
    signUpWithPassword,
    signInWithPassword,
    requestPasswordReset,
    updatePassword,
    signOut,
  } = useAuth();
  const navigate = useNavigate();

  const recoveryMode = useMemo(() => getRecoveryMode(), []);
  const [mode, setMode] = useState<Mode>(recoveryMode ?? 'sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (recoveryMode === 'reset') {
      setMode('reset');
    }
  }, [recoveryMode]);

  useEffect(() => {
    if (user) {
      navigate('/experience', { replace: true });
    }
  }, [navigate, user]);

  const resetFeedback = () => {
    setError('');
    setStatus('');
  };

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!email.trim() || !password.trim()) {
      setError('Enter both your email and password.');
      return;
    }

    setSubmitting(true);
    const result = await signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (result.error) {
      if (result.error.toLowerCase().includes('invalid login credentials')) {
        setError('Invalid email or password. If you just created this account, your Supabase project may still require email confirmation before first sign-in.');
      } else {
        setError(result.error);
      }
      return;
    }
  };

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!displayName.trim()) {
      setError('Enter a display name first.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password first.');
      return;
    }

    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await signUpWithPassword({
      email: email.trim(),
      password,
      displayName: displayName.trim(),
    });
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStatus('Account created. If email confirmation is enabled in Supabase, confirm your email before the first sign-in.');
    setMode('sign-in');
    setPassword('');
    setConfirmPassword('');
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }

    setSubmitting(true);
    const result = await requestPasswordReset(email.trim());
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStatus(`Password reset link sent to ${email.trim()}.`);
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!password.trim()) {
      setError('Enter your new password first.');
      return;
    }

    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setStatus('Password updated. You can keep using VoltShare with this account.');
    setPassword('');
    setConfirmPassword('');
  };

  const isFormDisabled = !hasSupabaseConfig || submitting;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(188,242,212,0.35),transparent_24%),linear-gradient(180deg,#f6fbf7_0%,#eff7f0_100%)] px-4 py-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/90 px-4 py-2 text-sm font-medium text-stone-700 shadow-[0_10px_20px_rgba(38,84,62,0.08)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-800">
            Account
          </span>
        </div>

        <section className="rounded-[2.2rem] bg-emerald-950 px-5 py-6 text-white shadow-[0_24px_60px_rgba(16,24,20,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-emerald-200">VoltShare</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                {mode === 'sign-up'
                  ? 'Create your account'
                  : mode === 'forgot'
                    ? 'Reset your password'
                    : mode === 'reset'
                      ? 'Choose a new password'
                      : 'Sign in with email'}
              </h1>
              <p className="mt-3 max-w-[17rem] text-sm leading-6 text-emerald-50/80">
                {mode === 'sign-up'
                  ? 'Create an account to save listings, purchases, wallet credits, avatar, and your full VoltShare history.'
                  : mode === 'forgot'
                    ? 'Enter your email and we will send you a password reset link.'
                    : mode === 'reset'
                      ? 'Set a fresh password for your VoltShare account and keep your saved history attached to this login.'
                      : 'Sign in to keep your profile, avatar, wallet balance, activity, and marketplace history under one account.'}
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-3">
              {mode === 'sign-up' ? (
                <UserRound className="h-6 w-6 text-emerald-100" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-emerald-100" />
              )}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <FeaturePill icon={Wallet} label="Save your history" />
            <FeaturePill icon={Sparkles} label="Avatar + profile" />
          </div>
        </section>

        {user ? null : (
          <section className="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(38,84,62,0.10)]">
            {!hasSupabaseConfig ? (
              <div className="mb-4 rounded-[1.4rem] border border-amber-200 bg-amber-50/85 px-4 py-4 text-sm leading-6 text-amber-950">
                Supabase is not configured yet. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to
                your local environment, then refresh.
              </div>
            ) : null}

            {mode !== 'forgot' && mode !== 'reset' ? (
              <div className="mb-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in');
                    resetFeedback();
                  }}
                  className={`rounded-[1.1rem] py-2.5 text-sm font-medium transition ${
                    mode === 'sign-in' ? 'bg-emerald-950 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <Mail className="mr-1.5 inline h-3.5 w-3.5 -mt-0.5" />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up');
                    resetFeedback();
                  }}
                  className={`rounded-[1.1rem] py-2.5 text-sm font-medium transition ${
                    mode === 'sign-up' ? 'bg-emerald-950 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <UserRound className="mr-1.5 inline h-3.5 w-3.5 -mt-0.5" />
                  Create account
                </button>
              </div>
            ) : null}

            {mode === 'sign-in' ? (
              <form className="space-y-4" onSubmit={handleSignIn}>
                <LabeledInput
                  label="Email address"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  disabled={isFormDisabled}
                />
                <LabeledInput
                  label="Password"
                  icon={Lock}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={setPassword}
                  disabled={isFormDisabled}
                />
                <ErrorBanner msg={error} />
                <StatusBanner msg={status} />
                <button className="primary-btn w-full" type="submit" disabled={isFormDisabled}>
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-stone-500 transition hover:text-stone-700"
                  onClick={() => {
                    setMode('forgot');
                    resetFeedback();
                  }}
                >
                  Forgot password?
                </button>
              </form>
            ) : null}

            {mode === 'sign-up' ? (
              <form className="space-y-4" onSubmit={handleSignUp}>
                <LabeledInput
                  label="Display name"
                  icon={UserRound}
                  type="text"
                  autoComplete="nickname"
                  placeholder="How should VoltShare show your name?"
                  value={displayName}
                  onChange={setDisplayName}
                  disabled={isFormDisabled}
                />
                <LabeledInput
                  label="Email address"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  disabled={isFormDisabled}
                />
                <LabeledInput
                  label="Password"
                  icon={Lock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={setPassword}
                  disabled={isFormDisabled}
                />
                <LabeledInput
                  label="Confirm password"
                  icon={Lock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  disabled={isFormDisabled}
                />
                <ErrorBanner msg={error} />
                <StatusBanner msg={status} />
                <button className="primary-btn w-full" type="submit" disabled={isFormDisabled}>
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
                  {submitting ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            ) : null}

            {mode === 'forgot' ? (
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                <LabeledInput
                  label="Email address"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={setEmail}
                  disabled={isFormDisabled}
                />
                <ErrorBanner msg={error} />
                <StatusBanner msg={status} />
                <button className="primary-btn w-full" type="submit" disabled={isFormDisabled}>
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {submitting ? 'Sending reset link…' : 'Send reset link'}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-stone-500 transition hover:text-stone-700"
                  onClick={() => {
                    setMode('sign-in');
                    resetFeedback();
                  }}
                >
                  Back to sign in
                </button>
              </form>
            ) : null}

            {mode === 'reset' ? (
              <form className="space-y-4" onSubmit={handleResetPassword}>
                <LabeledInput
                  label="New password"
                  icon={Lock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={setPassword}
                  disabled={isFormDisabled}
                />
                <LabeledInput
                  label="Confirm password"
                  icon={Lock}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  disabled={isFormDisabled}
                />
                <ErrorBanner msg={error} />
                <StatusBanner msg={status} />
                <button className="primary-btn w-full" type="submit" disabled={isFormDisabled}>
                  {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {submitting ? 'Saving password…' : 'Save new password'}
                </button>
              </form>
            ) : null}

            <div className="mt-5 rounded-[1.4rem] bg-stone-50/80 px-4 py-4 text-sm leading-6 text-stone-600">
              Guests can still explore VoltShare without signing in — an account simply lets VoltShare remember your
              avatar, display name, listings, purchases, and saved pricing history.
            </div>
          </section>
        )}
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

function LabeledInput({
  label,
  icon: Icon,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  label: string;
  icon: typeof Mail;
  type: string;
  autoComplete?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="field-block">
      <span className="field-label">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          className="input-control w-full pl-11"
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </div>
    </label>
  );
}
