import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { defaultDate, money, monthBounds, shortDate } from '../lib/format';
import type { Item, Kind, Tx } from '../types';
import { ItemSelect } from './ItemSelect';

interface Props {
  month: string;
  items: Item[];
  txs: Tx[];
  run: (fn: () => Promise<unknown>) => void;
}

const field =
  'w-full min-w-0 rounded border border-line bg-white px-2 py-1.5 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30';

export function Transactions({ month, items, txs, run }: Props) {
  const [type, setType] = useState<Kind>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDate(month));
  const [itemId, setItemId] = useState<number | null>(null);

  useEffect(() => {
    setDate(defaultDate(month));
    setItemId(null);
  }, [month]);

  const { min, max } = monthBounds(month);
  const options = items.filter((i) => i.kind === type);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = parseFloat(amount);
    if (!description.trim() || !(a > 0)) return;
    run(() => api.addTx({ date, description: description.trim(), amount: a, type, itemId }));
    setDescription('');
    setAmount('');
  };

  return (
    <section aria-labelledby="tx-title">
      <h2 id="tx-title" className="mb-3 text-lg font-bold">Transactions</h2>

      <form onSubmit={submit} className="mb-4 grid gap-2 rounded-lg border border-line bg-white p-3">
        <div className="grid grid-cols-2 gap-1 rounded bg-mint p-1" role="group" aria-label="Transaction type">
          {(['expense', 'income'] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => {
                setType(k);
                setItemId(null);
              }}
              className={`rounded py-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf ${
                type === k ? 'bg-white shadow-sm' : 'text-ink/70'
              }`}
            >
              {k === 'expense' ? 'Expense' : 'Income'}
            </button>
          ))}
        </div>
        <input
          className={field}
          placeholder="Description"
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={120}
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={`${field} tabular-nums`}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            placeholder="Amount"
            aria-label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <input
            className={field}
            type="date"
            aria-label="Date"
            min={min}
            max={max}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <ItemSelect items={options} value={itemId} onChange={setItemId} label="Budget item" className="py-1.5" />
        <button className="rounded bg-ink py-2 font-medium text-paper hover:bg-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
          Add transaction
        </button>
      </form>

      {txs.length === 0 ? (
        <p className="text-ink/70">No transactions this month. Add one above to see it count against a budget line.</p>
      ) : (
        <ul>
          {txs.map((t) => {
            const assigned = items.some((i) => i.id === t.itemId);
            return (
              <li key={t.id} className="border-b border-line py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{t.description}</span>
                  <span className={`shrink-0 tabular-nums ${t.type === 'income' ? 'font-medium text-leaf' : ''}`}>
                    {t.type === 'income' ? '+' : '−'}
                    {money(t.amount)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-ink/70">
                  <span>{shortDate(t.date)}</span>
                  <div className="flex min-w-0 items-center gap-1">
                    <ItemSelect
                      items={items.filter((i) => i.kind === t.type)}
                      value={t.itemId}
                      label={`Budget item for ${t.description}`}
                      className={`max-w-[11rem] ${assigned ? '' : 'border-gold text-gold'}`}
                      onChange={(v) => run(() => api.assignTx(t.id, v))}
                    />
                    <button
                      aria-label={`Delete ${t.description}`}
                      onClick={() => run(() => api.deleteTx(t.id))}
                      className="rounded px-2 py-1 text-lg leading-none hover:text-brick focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
