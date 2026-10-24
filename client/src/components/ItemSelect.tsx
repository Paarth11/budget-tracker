import type { Item } from '../types';

interface Props {
  items: Item[];
  value: number | null;
  onChange: (id: number | null) => void;
  label: string;
  className?: string;
}

export function ItemSelect({ items, value, onChange, label, className = '' }: Props) {
  const groups = [...new Set(items.map((i) => i.group))];
  const current = items.some((i) => i.id === value) ? String(value) : '';
  return (
    <select
      aria-label={label}
      value={current}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className={`rounded border border-line bg-white px-2 py-1 text-sm focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30 ${className}`}
    >
      <option value="">Unassigned</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {items
            .filter((i) => i.group === g)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
