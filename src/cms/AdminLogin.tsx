import React, { useEffect, useState } from 'react';
import { useCms } from './store';
import { getAdminCreds, issuePasswordReset, peekPasswordReset, consumePasswordReset } from './auth';

const fieldCls = 'w-full px-3.5 py-3 rounded-xl border border-slate-300 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white';

const BrandMark: React.FC = () => (
  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center mb-5">
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  </div>
);

export const AdminLoginPage: React.FC = () => {
  const { login, loggedIn, state } = useCms();
  const [view, setView] = useState<'login' | 'forgot' | 'sent'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loggedIn) window.location.hash = '#/admin';
  }, [loggedIn]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const ok = await login(username.trim(), password, remember);
    setBusy(false);
    if (ok) {
      window.location.hash = '#/admin';
      return;
    }
    setErr('Incorrect username or password.');
  };

  const onForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const token = issuePasswordReset(email, state.passcode);
    setInfo('If that email is registered, a reset link has been issued.');
    setResetLink(token ? `#/admin-reset?token=${token}` : '');
    setView('sent');
  };

  return (
    <div className="pt-28 pb-20 px-4 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <BrandMark />
        {view === 'login' && (
          <form onSubmit={onLogin}>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin login</h1>
            <p className="text-sm text-slate-500 mb-6">Sign in to manage pages, posts, tools and SEO.</p>
            <label className="block mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</span>
              <input className={`${fieldCls} mt-1`} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus required />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
              <input type="password" className={`${fieldCls} mt-1`} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </label>
            <div className="flex items-center justify-between gap-3 mb-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Remember me
              </label>
              <button type="button" onClick={() => { setView('forgot'); setErr(''); }} className="text-sm font-semibold text-indigo-600 hover:underline">Forgot password?</button>
            </div>
            {err && <p className="text-sm text-red-600 mb-3" role="alert">{err}</p>}
            <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-60">
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        )}
        {view === 'forgot' && (
          <form onSubmit={onForgot}>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot password</h1>
            <p className="text-sm text-slate-500 mb-6">Enter the admin email. If it matches, we will issue a one-time reset link.</p>
            <label className="block mb-4">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
              <input type="email" className={`${fieldCls} mt-1`} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus required />
            </label>
            {err && <p className="text-sm text-red-600 mb-3" role="alert">{err}</p>}
            <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:shadow-lg transition-all">Send reset link</button>
            <button type="button" onClick={() => setView('login')} className="w-full mt-3 text-sm font-semibold text-slate-600 hover:text-indigo-600">Back to sign in</button>
          </form>
        )}
        {view === 'sent' && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Check your email</h1>
            <p className="text-sm text-slate-600 mb-4" role="status">{info}</p>
            {resetLink ? (
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 mb-4">
                <p className="text-xs text-indigo-800 mb-2">This site runs in the browser, so the reset link is shown here instead of being emailed:</p>
                <a href={resetLink} className="text-sm font-semibold text-indigo-700 break-all hover:underline">{resetLink}</a>
                <p className="text-xs text-indigo-700 mt-2">The link expires in 60 minutes.</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-4">If you did not receive a link, check the address or contact {getAdminCreds(state.passcode).email}.</p>
            )}
            <button type="button" onClick={() => setView('login')} className="text-sm font-semibold text-indigo-600 hover:underline">Back to sign in</button>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminResetPage: React.FC = () => {
  const { setPasscode, loggedIn } = useCms();
  const token = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.slice(window.location.hash.indexOf('?') + 1) : '').get('token') || '';
  const valid = !!token && peekPasswordReset(token);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (loggedIn && !valid) window.location.hash = '#/admin';
  }, [loggedIn, valid]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (password.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (password !== confirm) { setErr('The two passwords do not match.'); return; }
    if (!consumePasswordReset(token)) { setErr('This reset link is invalid or has expired.'); return; }
    await setPasscode(password);
    setDone(true);
  };

  return (
    <div className="pt-28 pb-20 px-4 min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
        <BrandMark />
        {done ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Password updated</h1>
            <p className="text-sm text-slate-600 mb-6">You can now sign in with your new password.</p>
            <a href="#/admin-login" className="inline-flex w-full justify-center py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm">Sign In</a>
          </>
        ) : !valid ? (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset link expired</h1>
            <p className="text-sm text-slate-600 mb-6">That link is invalid or has expired. Request a new one from the login page.</p>
            <a href="#/admin-login" className="text-sm font-semibold text-indigo-600 hover:underline">Back to sign in</a>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Set a new password</h1>
            <p className="text-sm text-slate-500 mb-6">Choose a password of at least 8 characters.</p>
            <label className="block mb-3">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">New password</span>
              <input type="password" className={`${fieldCls} mt-1`} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" autoFocus required minLength={8} />
            </label>
            <label className="block mb-4">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Confirm password</span>
              <input type="password" className={`${fieldCls} mt-1`} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} />
            </label>
            {err && <p className="text-sm text-red-600 mb-3" role="alert">{err}</p>}
            <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-sm hover:shadow-lg transition-all">Save new password</button>
          </form>
        )}
      </div>
    </div>
  );
};
