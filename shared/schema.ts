import { z } from "zod";

export const MEMBER_NAMES = [
  "Rashid",
  "Ahmed",
  "Raid",
  "Saeed",
  "Mashal",
  "Salman",
  "Turki",
  "Abdullah",
  "Ali",
] as const;

export type MemberName = (typeof MEMBER_NAMES)[number];

export const CATEGORIES = ["Rent", "Setup", "Operating", "Worker", "Other"] as const;
export const PAYMENT_METHODS = ["Cash", "Bank transfer", "Card"] as const;
export const STATUSES = ["Paid", "Unpaid"] as const;

export interface Member {
  id: string;
  name: string;
}

export interface Settings {
  id: number;
  annual_rent: number;
  setup_cost: number;
  monthly_operating: number;
  worker_monthly: number;
  first_rent_date: string;
  second_rent_date: string;
  plan_start: string;
  plan_horizon_months: number;
}

export interface Expense {
  id: string;
  date: string;
  paid_by: string;
  amount: number;
  category: string;
  payment_method: string;
  description: string;
  notes: string | null;
  receipt_url: string | null;
  receipt_filename: string | null;
  status: string;
  included_in_budget: boolean;
  created_at: string;
}

// Per-category inclusion toggle (category_settings table)
export interface CategorySetting {
  category: string;
  included: boolean;
  updated_at?: string | null;
}

// Categories that participate in budget calculations / inclusion toggles
export const BUDGET_CATEGORIES = ["Setup", "Rent", "Operating", "Other"] as const;

// Per-category subtotal used by budget computations & live preview
export type CategorySubtotal = {
  category: string;
  included: boolean; // category_settings.included
  count: number; // number of expenses in this category
  included_count: number; // number of effectively-included expenses
  excluded_count: number; // number excluded (category off OR row off)
  included_amount: number; // sum of effectively-included amounts
  total_amount: number; // sum of ALL amounts in this category
};

// Validation schemas
export const insertExpenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  paid_by: z.enum(MEMBER_NAMES, { errorMap: () => ({ message: "Select a member" }) }),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.enum(CATEGORIES),
  payment_method: z.enum(PAYMENT_METHODS),
  description: z.string().min(3, "Description must be at least 3 characters"),
  notes: z.string().optional().nullable(),
  status: z.enum(STATUSES).default("Paid"),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export const updateSettingsSchema = z.object({
  annual_rent: z.coerce.number().int().nonnegative().optional(),
  setup_cost: z.coerce.number().int().nonnegative().optional(),
  monthly_operating: z.coerce.number().int().nonnegative().optional(),
  worker_monthly: z.coerce.number().int().nonnegative().optional(),
  first_rent_date: z.string().optional(),
  second_rent_date: z.string().optional(),
  plan_start: z.string().optional(),
  plan_horizon_months: z.coerce.number().int().positive().optional(),
});

export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type SummaryMember = {
  name: string;
  paid: number;
  share: number;
  balance: number;
  status: "Credit" | "Owes group" | "Settled";
};

export type Summary = {
  total_expenses: number;
  total_paid: number;
  total_unpaid: number;
  per_member_share: number;
  members: SummaryMember[];
  annual_budget: number;
  first_year_total: number;
  second_rent_due: number;
  months_until_2nd_rent: number;
  monthly_save_needed: number;
  // ── v4: inclusion-based figures ──
  grand_total_all: number; // sum of ALL recorded expenses, independent of inclusion
  included_total: number; // sum of all effectively-included expenses (budget side)
  setup_included_total: number; // dynamic تضبيط — effectively-included Setup total
  category_subtotals: CategorySubtotal[];
};
