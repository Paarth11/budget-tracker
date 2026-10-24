import type { BudgetData, Kind, User } from './types';

let unauthorized: (() => void) | null = null;
/** Called when a request comes back 401 (session expired), so the app can show the login screen. */
export const onUnauthorized = (fn: () => void) => {
  unauthorized = fn;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) unauthorized?.();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status}).`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  me: () => req<{ user: User }>('/auth/me'),
  login: (email: string, password: string) => req<{ user: User }>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  register: (email: string, password: string) => req<{ user: User }>('/auth/register', { method: 'POST', body: json({ email, password }) }),
  logout: () => req<void>('/auth/logout', { method: 'POST' }),

  getBudget: (month: string) => req<BudgetData>(`/budget/${month}`),
  startMonth: (month: string) => req<void>(`/budget/${month}/start`, { method: 'POST' }),
  addItem: (b: { month: string; kind: Kind; group: string; name: string; planned: number }) =>
    req<void>('/items', { method: 'POST', body: json(b) }),
  updateItem: (id: number, b: { planned?: number; name?: string }) =>
    req<void>(`/items/${id}`, { method: 'PATCH', body: json(b) }),
  deleteItem: (id: number) => req<void>(`/items/${id}`, { method: 'DELETE' }),
  addTx: (b: { date: string; description: string; amount: number; type: Kind; itemId: number | null }) =>
    req<void>('/transactions', { method: 'POST', body: json(b) }),
  assignTx: (id: number, itemId: number | null) =>
    req<void>(`/transactions/${id}`, { method: 'PATCH', body: json({ itemId }) }),
  deleteTx: (id: number) => req<void>(`/transactions/${id}`, { method: 'DELETE' }),
};
