import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { BudgetGroup } from './components/BudgetGroup';
import { Transactions } from './components/Transactions';
import { currentMonth, money, monthLabel, shiftMonth } from './lib/format';
import type { BudgetData, Kind, User } from './types';

const navBtn =
  'rounded-full px-3 py-1 text-2xl leading-none hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';

export default function Budget({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<BudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);
  const [view, setView] = useState<'budget' | 'transactions'>('budget');
  const [groupName, setGroupName] = useState('');
  const [firstItem, setFirstItem] = useState('');

  useEffect(() => {
    let stale = false;
    setData(null);
    api
      .getBudget(month)
      .then((d) => { if (!stale) setData(d); })
      .catch((e: Error) => { if (!stale) setError(e.message); });
    return () => { stale = true; };
  }, [month]);

  // Run a change, then refresh the month so every total stays in sync.
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      setData(await api.getBudget(month));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const items = data?.items ?? [];
  const hasBudget = items.length > 0;

  const totals = useMemo(() => {
    const sum = (k: Kind, f: 'planned' | 'spent') =>
      items.filter((i) => i.kind === k).reduce((s, i) => s + i[f], 0);
    const plannedIncome = sum('income', 'planned');
    const plannedSpending = sum('expense', 'planned');
    return {
      plannedIncome,
      plannedSpending,
      received: sum('income', 'spent'),
      spent: sum('expense', 'spent'),
      left: plannedIncome - plannedSpending,
    };
  }, [items]);

  const zero = Math.abs(totals.left) < 0.005;
  const band = !hasBudget ? 'bg-ink text-paper' : zero ? 'bg-leaf text-white' : totals.left < 0 ? 'bg-brick text-white' : 'bg-ink text-paper';
  const expenseGroups = [...new Set(items.filter((i) => i.kind === 'expense').map((i) => i.group))];

  const addGroup = (e: FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || !firstItem.trim()) return;
    run(() => api.addItem({ month, kind: 'expense', group: groupName.trim(), name: firstItem.trim(), planned: 0 }));
    setGroupName('');
    setFirstItem('');
    setAddingGroup(false);
  };

  const stats = [
    ['Planned income', totals.plannedIncome],
    ['Planned spending', totals.plannedSpending],
    ['Received', totals.received],
    ['Spent', totals.spent],
  ] as const;

  return (
    <>
      <header className={`${band} transition-colors motion-reduce:transition-none`}>
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 pt-3 text-sm sm:gap-4">
          <span className="min-w-0 truncate opacity-90" title={user.email}>{user.email}</span>
          <a href="/api/export/transactions.csv" download className="shrink-0 underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Export CSV</a>
          <button
            onClick={async () => {
              try { await api.logout(); } finally { onLogout(); }
            }}
            className="shrink-0 rounded border border-white/40 px-3 py-1 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Log out
          </button>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 sm:py-6">
          <div className="flex w-full items-center justify-between sm:w-auto sm:justify-start sm:gap-1">
            <button className={navBtn} aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <h1 className="text-center text-xl font-bold sm:w-52 sm:text-2xl">{monthLabel(month)}</h1>
            <button className={navBtn} aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
          {hasBudget && (
            <div className="text-left sm:text-right" aria-live="polite">
              <p className="text-3xl font-extrabold tabular-nums sm:text-5xl">{money(Math.abs(totals.left))}</p>
              <p className="text-sm">{zero ? 'Fully budgeted' : totals.left > 0 ? 'Left to budget' : 'Over-budgeted'}</p>
            </div>
          )}
        </div>
        {hasBudget && (
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-2 border-t border-white/20 px-4 py-3 text-sm sm:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="opacity-80">{label}</dt>
                <dd className="font-bold tabular-nums">{money(value)}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {error && (
        <div role="alert" className="mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded border border-brick bg-white px-4 py-2 text-brick">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-medium underline">Dismiss</button>
        </div>
      )}

      <div className="sticky top-0 z-10 flex border-b border-line bg-paper lg:hidden" role="tablist" aria-label="Section">
        {(['budget', 'transactions'] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`w-1/2 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf ${
              view === v ? 'border-b-2 border-leaf text-leaf' : 'text-ink/70'
            }`}
          >
            {v === 'budget' ? 'Budget' : 'Transactions'}
          </button>
        ))}
      </div>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-6 sm:py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className={`${view === 'budget' ? '' : 'hidden'} lg:block`}>
          {!data ? (
            <p className="text-ink/70">Loading budget…</p>
          ) : !hasBudget ? (
            <div className="rounded-lg border border-line bg-white p-8 text-center">
              <h2 className="text-xl font-bold">No budget for {monthLabel(month)} yet</h2>
              <p className="mx-auto mt-2 max-w-md text-ink/70">
                Copy the plan from your latest earlier month, or begin with a basic set of groups.
              </p>
              <button
                onClick={() => run(() => api.startMonth(month))}
                className="mt-5 rounded bg-leaf px-5 py-2 font-medium text-white hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              >
                Start budget
              </button>
            </div>
          ) : (
            <>
              <BudgetGroup title="Income" kind="income" month={month} items={items.filter((i) => i.kind === 'income')} run={run} />
              {expenseGroups.map((g) => (
                <BudgetGroup key={g} title={g} kind="expense" month={month} items={items.filter((i) => i.kind === 'expense' && i.group === g)} run={run} />
              ))}
              {addingGroup ? (
                <form onSubmit={addGroup} className="grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input autoFocus aria-label="Group name" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="rounded border border-line px-2 py-1.5 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30" />
                  <input aria-label="First item" placeholder="First item" value={firstItem} onChange={(e) => setFirstItem(e.target.value)} className="rounded border border-line px-2 py-1.5 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30" />
                  <div className="flex gap-2">
                    <button className="rounded bg-ink px-3 py-1.5 font-medium text-paper hover:bg-leaf">Add group</button>
                    <button type="button" onClick={() => setAddingGroup(false)} className="rounded px-3 py-1.5 hover:underline">Cancel</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setAddingGroup(true)} className="rounded border border-dashed border-ink/40 px-4 py-2 font-medium hover:border-leaf hover:text-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf">
                  Add group
                </button>
              )}
            </>
          )}
        </div>
        <aside className={`${view === 'transactions' ? '' : 'hidden'} lg:block`}>
          <Transactions month={month} items={items} txs={data?.transactions ?? []} run={run} />
        </aside>
      </main>
    </>
  );
}
