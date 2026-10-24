export type Kind = 'income' | 'expense';

export interface Item {
  id: number;
  month: string;
  kind: Kind;
  group: string;
  name: string;
  planned: number;
  spent: number; // for income lines: amount received
}

export interface Tx {
  id: number;
  itemId: number | null;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: Kind;
}

export interface BudgetData {
  items: Item[];
  transactions: Tx[];
}

export interface User {
  id: number;
  email: string;
}
