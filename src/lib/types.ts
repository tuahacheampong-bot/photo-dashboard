export type UserRole = 'owner' | 'worker';
export type GigStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type WorkerSkill = 'photographer' | 'retoucher' | 'both';
export type WorkerRole = 'photographer' | 'retoucher';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money' | 'card' | 'other';
export type InvoiceStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled';
export type InvoiceSource = 'zoho' | 'manual';
export type WorkerPaymentStatus = 'pending' | 'paid' | 'cancelled';

export interface User {
  id: number;
  email: string;
  name: string;
  password: string;
  role: UserRole;
  created_at: string;
}

export interface Worker {
  id: number;
  user_id: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  skills: WorkerSkill;
  rate_per_gig: number;
  created_at: string;
}

export interface Gig {
  id: number;
  title: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  gig_date: string;
  location: string | null;
  description: string | null;
  total_amount: number;
  photographer_split: number;
  retoucher_split: number;
  status: GigStatus;
  invoice_reference: string | null;
  zoho_invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GigWorker {
  id: number;
  gig_id: number;
  worker_id: number;
  role: WorkerRole;
  custom_split: number | null;
  created_at: string;
}

export interface Invoice {
  id: number;
  gig_id: number | null;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  due_date: string | null;
  status: InvoiceStatus;
  source: InvoiceSource;
  zoho_invoice_id: string | null;
  created_at: string;
}

export interface ClientPayment {
  id: number;
  gig_id: number;
  invoice_id: number | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface WorkerPayment {
  id: number;
  gig_id: number;
  worker_id: number;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  status: WorkerPaymentStatus;
  notes: string | null;
  created_at: string;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  is_default: number;
  created_at: string;
}

export interface Expense {
  id: number;
  category_id: number | null;
  description: string;
  amount: number;
  expense_date: string;
  gig_id: number | null;
  receipt_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface ZohoSettings {
  id: number;
  client_id: string | null;
  client_secret: string | null;
  refresh_token: string | null;
  organization_id: string | null;
  region: string;
  updated_at: string;
}

export interface ZohoInvoice {
  zoho_id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  balance: number;
  status: string;
  due_date: string | null;
  date: string;
}

export interface DashboardStats {
  totalGigs: number;
  completedGigs: number;
  pendingGigs: number;
  totalRevenue: number;
  totalExpenses: number;
  totalClientPayments: number;
  totalWorkerPayments: number;
  outstandingBalance: number;
  netProfit: number;
}

export interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
}

export interface WorkerEarnings {
  name: string;
  total_earned: number;
}

export interface RecentGig extends Gig {
  worker_ids: string | null;
}

export interface GigWithDetails extends Gig {
  worker_names: string | null;
  worker_roles: string | null;
  total_paid: number;
  outstanding: number;
  worker_paid: number;
  net_profit: number;
}

export interface GigWorkerInput {
  worker_id: number;
  role: WorkerRole;
  custom_split?: number | null;
}

export interface InvoiceInput {
  gig_id: number;
  invoice_number: string;
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  amount: number;
  total_amount: number;
  due_date?: string | null;
  status: InvoiceStatus;
  source: InvoiceSource;
}

export interface ClientPaymentInput {
  gig_id: number;
  invoice_id?: number | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
}

export interface WorkerPaymentInput {
  gig_id: number;
  worker_id: number;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  status: WorkerPaymentStatus;
  notes?: string | null;
}

export interface ExpenseInput {
  category_id?: number | null;
  description: string;
  amount: number;
  expense_date: string;
  gig_id?: number | null;
  receipt_reference?: string | null;
  notes?: string | null;
}

export interface WorkerInput {
  user_id?: number | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  skills: WorkerSkill;
  rate_per_gig?: number;
}

export interface QueryParams {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}