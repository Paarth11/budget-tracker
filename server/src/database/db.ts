import { Pool, types } from 'pg';

types.setTypeParser(1700, (v) => parseFloat(v)); // NUMERIC -> number
types.setTypeParser(1082, (v) => v); // DATE -> 'YYYY-MM-DD' string

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budget_items (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month      CHAR(7) NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  group_name TEXT NOT NULL,
  name       TEXT NOT NULL,
  planned    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (planned >= 0)
);

CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     INTEGER REFERENCES budget_items(id) ON DELETE SET NULL,
  date        DATE NOT NULL,
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense'))
);

-- Databases created before login existed: add the owner column. Old rows have no
-- owner, so they simply stay invisible to every account.
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS budget_items_user_month_idx ON budget_items (user_id, month);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS transactions_item_idx ON transactions (item_id);
`;

export const migrate = () => pool.query(schema);
