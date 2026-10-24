import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'test-jwt-secret';

// vi.mock() is moved to the top of the file, so anything its factory uses
// must be created with vi.hoisted(). The secret is also set here, before the
// app is imported, because the server reads JWT_SECRET once when it loads.
const { query } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  return { query: vi.fn() };
});

vi.mock('../src/database/db', () => ({
  pool: { query },
  migrate: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';

function sessionCookie(userId = 7) {
  const token = jwt.sign({ sub: String(userId) }, SECRET);
  return `token=${token}`;
}

describe('Express API', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('requires a session for budget routes', async () => {
    const response = await request(app).get('/api/budget/2026-10');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Please log in.' });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns a user budget and transactions for a valid month', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, month: '2026-10', planned: 500, spent: 125 }], rowCount: 1 });
    query.mockResolvedValueOnce({ rows: [{ id: 4, amount: 25, type: 'expense' }], rowCount: 1 });

    const response = await request(app)
      .get('/api/budget/2026-10')
      .set('Cookie', sessionCookie(12));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [{ id: 1, month: '2026-10', planned: 500, spent: 125 }],
      transactions: [{ id: 4, amount: 25, type: 'expense' }],
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual([12, '2026-10']);
    expect(query.mock.calls[1][1]).toEqual([12, '2026-10']);
  });

  it('rejects malformed budget month values', async () => {
    const response = await request(app)
      .get('/api/budget/2026-13')
      .set('Cookie', sessionCookie());

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Month must look like/);
    expect(query).not.toHaveBeenCalled();
  });

  it('validates transaction input before writing', async () => {
    const response = await request(app)
      .post('/api/transactions')
      .set('Cookie', sessionCookie())
      .send({ date: '2026-10-01', description: 'Coffee', amount: 0, type: 'expense' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Amount must be more than 0.');
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects a transaction linked to an unavailable budget item', async () => {
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const response = await request(app)
      .post('/api/transactions')
      .set('Cookie', sessionCookie(9))
      .send({ date: '2026-10-01', description: 'Groceries', amount: 40, type: 'expense', itemId: 55 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('That budget item is not available for this transaction.');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT 1 FROM budget_items'),
      [55, 9, 'expense', '2026-10'],
    );
  });
});