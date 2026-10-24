import 'dotenv/config';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { ZodError } from 'zod';
import { authRouter } from '../routes/auth';
import { requireAuth } from '../middleware/auth';
import { migrate } from '../database/db';
import { router } from '../routes/api';

export const app = express();
app.set('trust proxy', 1); // correct client IPs / HTTPS behind a load balancer
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api', requireAuth, router);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// In production the API also serves the built React app, so one container does it all.
if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../../../client/dist');
  app.use(express.static(dist));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid input.' });
    return;
  }
  const code = (err as { code?: string }).code;
  if (code?.startsWith('22')) {
    res.status(400).json({ error: 'Invalid value.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 4000);
  migrate()
    .then(() => app.listen(port, () => console.log(`API listening on http://localhost:${port}`)))
    .catch((e) => {
      console.error('Could not connect to the database:', e.message);
      process.exit(1);
    });
}
