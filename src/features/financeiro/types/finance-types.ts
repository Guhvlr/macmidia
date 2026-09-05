// ═══════════════════════════════════════════════
// FINANCEIRO — Type Definitions
// ═══════════════════════════════════════════════

export type FinanceEntryType = 'entrada' | 'saida';

export type FinanceStatus = 'previsto' | 'pago' | 'atrasado' | 'cancelado';

export type PaymentMethod = 'boleto' | 'pix' | 'cartao' | 'dinheiro' | 'transferencia' | '';

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  type: FinanceEntryType | 'ambos';
  color: string;
  icon?: string;
  is_default: boolean;
  created_at: string;
}

export interface FinanceEntry {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: FinanceEntryType;
  category_id: string | null;
  category?: FinanceCategory;
  status: FinanceStatus;
  payment_method: PaymentMethod;
  client_name: string;
  notes: string;
  is_recurring: boolean;
  recurring_months: number;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installment_total?: number | null;
  original_due_day?: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceAIChat {
  id: string;
  user_id: string;
  messages: AIChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface FinanceMonthlySummary {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  entradasRecebidas: number;
  saidasPagas: number;
}

export interface FinanceProjectionRow {
  month: string; // "Agosto/2026"
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface FinanceCategoryBreakdown {
  category: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface FinanceFilters {
  category?: string;
  status?: FinanceStatus;
  paymentMethod?: PaymentMethod;
  clientName?: string;
  search?: string;
}

// Default categories to seed for new users
export const DEFAULT_CATEGORIES: Omit<FinanceCategory, 'id' | 'user_id' | 'created_at'>[] = [
  { name: 'Despesas Fixas', type: 'saida', color: '#3b82f6', is_default: true },
  { name: 'Imposto', type: 'saida', color: '#10b981', is_default: true },
  { name: 'Empréstimo', type: 'saida', color: '#f59e0b', is_default: true },
  { name: 'Saúde', type: 'saida', color: '#f97316', is_default: true },
  { name: 'Alimentação', type: 'saida', color: '#ef4444', is_default: true },
  { name: 'Transporte', type: 'saida', color: '#8b5cf6', is_default: true },
  { name: 'Cartão de Crédito', type: 'saida', color: '#ec4899', is_default: true },
  { name: 'Contas', type: 'saida', color: '#06b6d4', is_default: true },
  { name: 'Salário', type: 'entrada', color: '#22c55e', is_default: true },
  { name: 'Freelance', type: 'entrada', color: '#14b8a6', is_default: true },
  { name: 'Investimentos', type: 'entrada', color: '#a855f7', is_default: true },
  { name: 'Outros', type: 'ambos', color: '#6b7280', is_default: true },
];
