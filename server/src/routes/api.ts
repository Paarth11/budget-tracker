import { Response, Router } from 'express';
import { z } from 'zod';
import { pool } from '../database/db';

export const router = Router();

const uid = (res: Response) => res.locals.userId as number;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-10.');
const id = z.coerce.number().int().positive();
const kind = z.enum(['income', 'expense']);
const amount = z.number().max(1e9, 'Amount is too large.');

const ITEM_COLS = `id, month, kind, group_name AS "group", name, planned`;
const TX_COLS = `id, item_id AS "itemId", date, description, amount, type`;

const TEMPLATE: [string, string, string][] = [
  ['income', 'Income', 'Paycheck'],
  ['expense', 'Giving', 'Charity'],
  ['expense', 'Savings', 'Emergency fund'],
  ['expense', 'Housing', 'Rent'],
  ['expense', 'Housing', 'Utilities'],
  ['expense', 'Transportation', 'Fuel'],
  ['expense', 'Food', 'Groceries'],
  ['expense', 'Food', 'Dining out'],
  ['expense', 'Personal', 'Subscriptions'],
  ['expense', 'Health', 'Medical'],
];

// Budget for one month: lines with amount spent, plus that month's transactions.
router.get('/budget/:month', async (req, res) => {
  const m = month.parse(req.params.month);
  const items = await pool.query(
    `SELECT i.id, i.month, i.kind, i.group_name AS "group", i.name, i.planned,
            COALESCE(SUM(t.amount), 0) AS spent
       FROM budget_items i
       LEFT JOIN transactions t
         ON t.item_id = i.id AND to_char(t.date, 'YYYY-MM') = i.month
      WHERE i.user_id = $1 AND i.month = $2
      GROUP BY i.id
      ORDER BY i.id`,
    [uid(res), m],
  );
  const transactions = await pool.query(
    `SELECT ${TX_COLS} FROM transactions
      WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
      ORDER BY date DESC, id DESC`,
    [uid(res), m],
  );
  res.json({ items: items.rows, transactions: transactions.rows });
});

// Start a month: copy the latest earlier month's plan, or seed a basic template.
router.post('/budget/:month/start', async (req, res) => {
  const m = month.parse(req.params.month);
  const u = uid(res);
  const existing = await pool.query('SELECT 1 FROM budget_items WHERE user_id = $1 AND month = $2 LIMIT 1', [u, m]);
  if (existing.rowCount) {
    res.status(409).json({ error: 'This month already has a budget.' });
    return;
  }
  const prev = await pool.query(
    'SELECT month FROM budget_items WHERE user_id = $1 AND month < $2 ORDER BY month DESC LIMIT 1',
    [u, m],
  );
  if (prev.rowCount) {
    await pool.query(
      `INSERT INTO budget_items (user_id, month, kind, group_name, name, planned)
       SELECT $1::int, $2::char(7), kind, group_name, name, planned
         FROM budget_items WHERE user_id = $1 AND month = $3 ORDER BY id`,
      [u, m, prev.rows[0].month],
    );
  } else {
    for (const [k, g, n] of TEMPLATE) {
      await pool.query(
        'INSERT INTO budget_items (user_id, month, kind, group_name, name) VALUES ($1, $2, $3, $4, $5)',
        [u, m, k, g, n],
      );
    }
  }
  res.status(201).json({ ok: true });
});

// ---- Budget lines ----
const itemBody = z.object({
  month,
  kind,
  group: z.string().trim().min(1, 'Group name is required.').max(60),
  name: z.string().trim().min(1, 'Item name is required.').max(80),
  planned: amount.min(0).default(0),
});

router.post('/items', async (req, res) => {
  const b = itemBody.parse(req.body);
  const r = await pool.query(
    `INSERT INTO budget_items (user_id, month, kind, group_name, name, planned)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${ITEM_COLS}`,
    [uid(res), b.month, b.kind, b.group, b.name, b.planned],
  );
  res.status(201).json(r.rows[0]);
});

router.patch('/items/:id', async (req, res) => {
  const itemId = id.parse(req.params.id);
  const b = itemBody.pick({ group: true, name: true }).extend({ planned: amount.min(0) }).partial().parse(req.body);
  const r = await pool.query(
    `UPDATE budget_items
        SET name = COALESCE($2, name),
            planned = COALESCE($3, planned),
            group_name = COALESCE($4, group_name)
      WHERE id = $1 AND user_id = $5 RETURNING ${ITEM_COLS}`,
    [itemId, b.name ?? null, b.planned ?? null, b.group ?? null, uid(res)],
  );
  if (!r.rowCount) {
    res.status(404).json({ error: 'Budget item not found.' });
    return;
  }
  res.json(r.rows[0]);
});

router.delete('/items/:id', async (req, res) => {
  await pool.query('DELETE FROM budget_items WHERE id = $1 AND user_id = $2', [id.parse(req.params.id), uid(res)]);
  res.status(204).end();
});

// ---- Transactions ----
const txBody = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must look like 2026-10-19.'),
  description: z.string().trim().min(1, 'Description is required.').max(120),
  amount: amount.positive('Amount must be more than 0.'),
  type: kind,
  itemId: z.number().int().nullable().default(null),
});

// A transaction may only point at the user's own line of the same kind, in the same month.
async function itemFits(userId: number, itemId: number | null, date: string, type: string) {
  if (itemId === null) return true;
  const r = await pool.query(
    'SELECT 1 FROM budget_items WHERE id = $1 AND user_id = $2 AND kind = $3 AND month = $4',
    [itemId, userId, type, date.slice(0, 7)],
  );
  return r.rowCount === 1;
}

router.post('/transactions', async (req, res) => {
  const b = txBody.parse(req.body);
  if (!(await itemFits(uid(res), b.itemId, b.date, b.type))) {
    res.status(400).json({ error: 'That budget item is not available for this transaction.' });
    return;
  }
  const r = await pool.query(
    `INSERT INTO transactions (user_id, item_id, date, description, amount, type)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${TX_COLS}`,
    [uid(res), b.itemId, b.date, b.description, b.amount, b.type],
  );
  res.status(201).json(r.rows[0]);
});

router.patch('/transactions/:id', async (req, res) => {
  const txId = id.parse(req.params.id);
  const { itemId } = z.object({ itemId: z.number().int().nullable() }).parse(req.body);
  const t = await pool.query('SELECT date, type FROM transactions WHERE id = $1 AND user_id = $2', [txId, uid(res)]);
  if (!t.rowCount) {
    res.status(404).json({ error: 'Transaction not found.' });
    return;
  }
  if (!(await itemFits(uid(res), itemId, t.rows[0].date, t.rows[0].type))) {
    res.status(400).json({ error: 'That budget item is not available for this transaction.' });
    return;
  }
  const r = await pool.query(
    `UPDATE transactions SET item_id = $2 WHERE id = $1 AND user_id = $3 RETURNING ${TX_COLS}`,
    [txId, itemId, uid(res)],
  );
  res.json(r.rows[0]);
});

router.delete('/transactions/:id', async (req, res) => {
  await pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id.parse(req.params.id), uid(res)]);
  res.status(204).end();
});

// ---- Backup: every transaction as CSV (opens in Excel / Google Sheets) ----
const cell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

router.get('/export/transactions.csv', async (_req, res) => {
  const r = await pool.query(
    `SELECT t.date, t.description, t.type, t.amount, i.group_name AS "group", i.name AS item
       FROM transactions t LEFT JOIN budget_items i ON i.id = t.item_id
      WHERE t.user_id = $1 ORDER BY t.date, t.id`,
    [uid(res)],
  );
  const header = ['Date', 'Description', 'Type', 'Amount', 'Group', 'Budget item'];
  const rows = r.rows.map((x) => [x.date, x.description, x.type, x.amount, x.group, x.item].map(cell).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
  res.send([header.join(','), ...rows].join('\r\n') + '\r\n');
});
