import { FormEvent, useState } from 'react';
import { api } from '../api';
import { money } from '../lib/format';
import type { Item, Kind } from '../types';

interface Props {
  title: string;
  kind: Kind;
  month: string;
  items: Item[];
  run: (fn: () => Promise<unknown>) => void;
}

// Phones: name + planned. From sm up: name + planned + spent.
const COLS =
  'grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem]';

const input =
  'rounded border border-line bg-white px-2 py-1.5 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30';

export function BudgetGroup({ title, kind, month, items, run }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const planned = items.reduce((s, i) => s + i.planned, 0);
  const spent = items.reduce((s, i) => s + i.spent, 0);
  const spentLabel = kind === 'income' ? 'Received' : 'Spent';
  const noun = kind === 'income' ? 'income' : 'item';

  const close = () => {
    setName('');
    setAmount('');
    setAdding(false);
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const a = amount === '' ? 0 : parseFloat(amount);
    if (!n || !Number.isFinite(a) || a < 0) return;
    run(() => api.addItem({ month, kind, group: title, name: n, planned: a }));
    close();
  };

  const remove = (i: Item) => {
    if ((i.spent > 0 || i.planned > 0) && !window.confirm(`Delete "${i.name}"? Its transactions become unassigned.`)) return;
    run(() => api.deleteItem(i.id));
  };

  return (
    <section className="mb-8">
      <div className={`${COLS} border-b-2 border-ink pb-1`}>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <p className="text-xs text-ink/60 sm:hidden">
            {spentLabel} {money(spent)}
          </p>
        </div>
        <p className="text-right text-sm font-bold tabular-nums">
          <span className="block text-xs font-normal text-ink/60">Planned</span>
          {money(planned)}
        </p>
        <p className="hidden text-right text-sm font-bold tabular-nums sm:block">
          <span className="block text-xs font-normal text-ink/60">{spentLabel}</span>
          {money(spent)}
        </p>
      </div>

      {kind === 'income' && planned === 0 && (
        <p className="mt-2 text-sm text-ink/70">
          Type what you expect to earn this month in the Planned box, then assign it to the groups below.
        </p>
      )}

      <ul>
        {items.map((i) => {
          const left = i.planned - i.spent;
          const over = kind === 'expense' && left < -0.005;
          const ratio = i.planned > 0 ? Math.min(i.spent / i.planned, 1) : i.spent > 0 ? 1 : 0;
          const note =
            kind === 'income'
              ? left > 0.005 ? `${money(left)} still expected` : 'Received in full'
              : over ? `${money(-left)} over` : `${money(left)} left`;
          return (
            <li key={i.id} className={`${COLS} border-b border-line py-2`}>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate">{i.name}</span>
                  <button
                    aria-label={`Delete ${i.name}`}
                    onClick={() => remove(i)}
                    className="rounded px-2 py-1 text-ink/50 hover:text-brick focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-mint" aria-hidden="true">
                  <div
                    className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${over ? 'bg-brick' : 'bg-leaf'}`}
                    style={{ width: `${ratio * 100}%` }}
                  />
                </div>
                <p className={`mt-0.5 text-xs ${over ? 'font-medium text-brick' : 'text-ink/60'}`}>
                  <span className="sm:hidden">
                    {money(i.spent)} {kind === 'income' ? 'received' : 'spent'},{' '}
                  </span>
                  {note}
                </p>
              </div>
              <input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-label={`Planned amount for ${i.name}`}
                key={`${i.id}-${i.planned}`}
                defaultValue={i.planned}
                onFocus={(e) => e.target.select()}
                onBlur={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!Number.isFinite(v) || v < 0) {
                    e.target.value = String(i.planned);
                    return;
                  }
                  if (v !== i.planned) run(() => api.updateItem(i.id, { planned: v }));
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className={`${input} w-full text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
              />
              <span className="hidden text-right tabular-nums sm:block">{money(i.spent)}</span>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form onSubmit={add} className="mt-3 grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
          <input
            autoFocus
            className={`${input} min-w-0`}
            aria-label={`New ${noun} name in ${title}`}
            placeholder={kind === 'income' ? 'Income source, e.g. Salary' : 'Item name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
          <input
            className={`${input} min-w-0 tabular-nums`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-label="Planned amount"
            placeholder="Planned"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="flex-1 rounded bg-ink px-3 py-1.5 font-medium text-paper hover:bg-leaf focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf">
              Add
            </button>
            <button type="button" onClick={close} className="rounded px-3 py-1.5 hover:underline">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 rounded px-1 py-1 text-sm font-medium text-leaf hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-leaf"
        >
          Add {noun}
        </button>
      )}
    </section>
  );
}
