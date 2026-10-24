import { Response, Router } from 'express';
import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from '../database/db';
import { requireAuth } from '../middleware/auth';

const COOKIE = 'token';
const SESSION_DAYS = 30;

function loadSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production.');
  console.warn('JWT_SECRET is not set; using an insecure development secret.');
  return 'dev-secret-change-me';
}
const SECRET = loadSecret();

// Cookies are Secure in production (needs HTTPS). Override with COOKIE_SECURE=true|false.
const secureCookie = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : process.env.NODE_ENV === 'production';

function startSession(res: Response, userId: number) {
  const token = jwt.sign({ sub: String(userId) }, SECRET, { expiresIn: SESSION_DAYS * 24 * 60 * 60 });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookie,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const registerBody = z.object({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be 72 characters or fewer.'),
});
const loginBody = z.object({ email, password: z.string().min(1, 'Enter your password.').max(72) });

// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export const authRouter = Router();

authRouter.post('/register', limiter, async (req, res) => {
  const b = registerBody.parse(req.body);
  const hash = await bcrypt.hash(b.password, 12);
  try {
    const r = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [b.email, hash]);
    startSession(res, r.rows[0].id);
    res.status(201).json({ user: r.rows[0] });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'An account with that email already exists.' });
      return;
    }
    throw e;
  }
});

authRouter.post('/login', limiter, async (req, res) => {
  const b = loginBody.parse(req.body);
  const r = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [b.email]);
  const user = r.rows[0];
  const ok = await bcrypt.compare(b.password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    res.status(401).json({ error: 'Incorrect email or password.' });
    return;
  }
  startSession(res, user.id);
  res.json({ user: { id: user.id, email: user.email } });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (_req, res) => {
  const r = await pool.query('SELECT id, email FROM users WHERE id = $1', [res.locals.userId]);
  if (!r.rowCount) {
    res.clearCookie(COOKIE);
    res.status(401).json({ error: 'Please log in.' });
    return;
  }
  res.json({ user: r.rows[0] });
});
