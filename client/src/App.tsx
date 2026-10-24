import { useEffect, useState } from 'react';
import { api, onUnauthorized } from './api';
import AuthForm from './AuthForm';
import Budget from './Budget';
import type { User } from './types';

export default function App() {
  // undefined = still checking for a saved session
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    onUnauthorized(() => setUser(null));
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <p className="p-8 text-ink/70">Loading…</p>;
  if (user === null) return <AuthForm onAuth={setUser} />;
  return <Budget key={user.id} user={user} onLogout={() => setUser(null)} />;
}
