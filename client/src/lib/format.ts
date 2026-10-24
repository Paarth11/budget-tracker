// Change these two to switch currency formatting.
const CURRENCY = 'NPR';
const LOCALE = 'np-NP';

const fmt = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 2,
});

export const money = (n: number) => fmt.format(n);

const pad = (n: number) => String(n).padStart(2, '0');

export const shiftMonth = (month: string, delta: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

export const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { min: `${month}-01`, max: `${month}-${pad(new Date(y, m, 0).getDate())}` };
};

// Today when viewing the current month, otherwise the first day of the month.
export const defaultDate = (month: string) =>
  month === currentMonth() ? new Date().toLocaleDateString('en-CA') : `${month}-01`;
