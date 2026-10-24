import { FormEvent, useState } from 'react';
import { api } from './api';
import type { User } from './types';

const field =
  'w-full rounded border border-line bg-white px-3 py-2 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30';

export default function AuthForm({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = isLogin ? await api.login(email, password) : await api.register(email, password);
      onAuth(user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold">Expense tracker</h1>
          <p className="mt-1 text-paper/80">Plan your month, then track every expense against it.</p>
        </div>
      </header>

      <main className="mx-auto max-w-sm px-4 py-8 sm:py-12">
        <h2 className="text-xl font-bold">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
        <p className="mt-1 text-ink/70">Your budget is saved to your account, so it is here whenever you come back.</p>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <label className="grid gap-1 text-sm font-medium">
            Email
            <input className={field} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Password
            <input
              className={field}
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? undefined : 8}
              maxLength={72}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!isLogin && <span className="text-xs font-normal text-ink/60">At least 8 characters.</span>}
          </label>

          {error && (
            <p role="alert" className="rounded border border-brick bg-white px-3 py-2 text-sm text-brick">
              {error}
            </p>
          )}

          <button
            disabled={busy}
            className="rounded bg-leaf py-2.5 font-medium text-white hover:bg-ink disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
          >
            {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-sm">
          {isLogin ? 'New here?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login');
              setError(null);
            }}
            className="font-medium text-leaf underline underline-offset-2"
          >
            {isLogin ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </main>
    </div>
  );
}
