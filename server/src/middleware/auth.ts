import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const COOKIE = 'token';

function loadSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production.');
  console.warn('JWT_SECRET is not set; using an insecure development secret.');
  return 'dev-secret-change-me';
}

const SECRET = loadSecret();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = jwt.verify(req.cookies?.[COOKIE], SECRET) as jwt.JwtPayload;
    res.locals.userId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: 'Please log in.' });
  }
}
