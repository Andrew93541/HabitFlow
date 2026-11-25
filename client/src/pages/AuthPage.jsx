import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Flame,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  getLocalTodayDateString,
  loginAccount,
  loginDemoAccount,
  registerAccount,
} from '../services/api';

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [includeStarterHabits, setIncludeStarterHabits] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter your email address and password.');
      return;
    }

    if (mode === 'register') {
      if (name.trim().length < 2) {
        setErrorMessage('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const localDate = getLocalTodayDateString();
      const response =
        mode === 'register'
          ? await registerAccount(
              {
                name: name.trim(),
                email: trimmedEmail,
                password,
                includeStarterHabits,
              },
              localDate
            )
          : await loginAccount({ email: trimmedEmail, password });

      onAuthenticated(response.user);
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMessage('');
    setIsDemoLoading(true);
    try {
      const response = await loginDemoAccount(getLocalTodayDateString());
      onAuthenticated(response.user);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to launch demo session.');
    } finally {
      setIsDemoLoading(false);
    }
  };

  const isBusy = isSubmitting || isDemoLoading;

  return (
    <div className="min-h-screen bg-[#F7F9F8] flex flex-col lg:flex-row">
      {/* Left Brand & Value Proposition Panel */}
      <div className="lg:w-1/2 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                HabitFlow
              </h1>
              <p className="text-xs font-medium text-slate-500">
                Daily Habit &amp; Streak Platform
              </p>
            </div>
          </div>

          <div className="mt-10 lg:mt-16 max-w-lg space-y-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-400" />
              Build lasting daily consistency
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
              Small daily check-ins that compound into real streaks.
            </h2>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Track personal daily routines, watch completed habits light up in emerald green, inspect monthly calendar heatmaps, and own your data with instant CSV &amp; JSON backups.
            </p>

            <ul className="space-y-3 pt-2 text-sm text-slate-700">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Private, isolated workspace for every user account</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Accurate local-date consecutive streak engine &amp; monthly heatmaps</span>
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Full data portability with one-click CSV/JSON export &amp; restore</span>
              </li>
            </ul>
          </div>
        </div>

        <p className="hidden lg:block text-xs text-slate-400 mt-12">
          HabitFlow Production Release &middot; Secure HttpOnly Session Architecture
        </p>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
            {/* Mode Switcher */}
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-2 rounded-xl bg-slate-100 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                disabled={isBusy}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => switchMode('register')}
                disabled={isBusy}
                className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {errorMessage}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === 'register' ? (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    disabled={isBusy}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'
                    }
                    disabled={isBusy}
                    className="w-full rounded-xl border border-slate-300 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'register' ? (
                <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeStarterHabits}
                    onChange={(e) => setIncludeStarterHabits(e.target.checked)}
                    disabled={isBusy}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    Populate my workspace with <strong>4 sample habits</strong> so I can explore streaks right away.
                  </span>
                </label>
              ) : null}

              <button
                type="submit"
                disabled={isBusy}
                data-testid="auth-submit-btn"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm py-3 px-4 shadow-sm shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{mode === 'register' ? 'Creating account...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <>
                    <span>{mode === 'register' ? 'Create Free Account' : 'Sign In'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-slate-400 font-medium">
                  or explore immediately
                </span>
              </div>
            </div>

            {/* 1-Click Demo Sandbox CTA */}
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isBusy}
              data-testid="demo-login-btn"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 disabled:opacity-60 text-emerald-800 font-semibold text-sm py-2.5 px-4 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {isDemoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <Zap className="h-4 w-4 text-emerald-600" />
              )}
              <span>Try Instant Demo Account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
