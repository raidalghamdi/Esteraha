/**
 * All Supabase data access helpers used by React Query.
 * Each function can be used as a queryFn.
 */

import { supabase } from "./supabase";
import type { Member, Settings, Expense, Summary, SummaryMember } from "@shared/schema";
import { MEMBER_NAMES } from "@shared/schema";

// ──────────────────────────────────────────
// Members
// ──────────────────────────────────────────
export async function fetchMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data as Member[];
}

// ──────────────────────────────────────────
// Settings
// ──────────────────────────────────────────
export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(error.message);
  return data as Settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Settings;
}

// ──────────────────────────────────────────
// Expenses
// ──────────────────────────────────────────
export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Expense[];
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────
// Summary (computed client-side)
// ──────────────────────────────────────────
export function computeSummary(expenses: Expense[], settings: Settings): Summary {
  const total_expenses = expenses.reduce((s, e) => s + e.amount, 0);
  const total_paid = expenses
    .filter((e) => e.status === "Paid")
    .reduce((s, e) => s + e.amount, 0);
  const total_unpaid = expenses
    .filter((e) => e.status === "Unpaid")
    .reduce((s, e) => s + e.amount, 0);

  const per_member_share = total_paid / MEMBER_NAMES.length;

  const members: SummaryMember[] = MEMBER_NAMES.map((name) => {
    const paid = expenses
      .filter((e) => e.status === "Paid" && e.paid_by === name)
      .reduce((s, e) => s + e.amount, 0);
    const balance = paid - per_member_share;
    let status: SummaryMember["status"] = "Settled";
    if (balance > 100) status = "Credit";
    else if (balance < -100) status = "Owes group";
    return { name, paid, share: per_member_share, balance, status };
  });

  const annual_budget =
    settings.annual_rent +
    settings.monthly_operating * 12 +
    settings.worker_monthly * 12;
  const first_year_total = annual_budget + settings.setup_cost;

  const second_rent_due = settings.annual_rent / 2;
  const today = new Date();
  const second = new Date(settings.second_rent_date);
  const monthsDiff =
    (second.getFullYear() - today.getFullYear()) * 12 +
    (second.getMonth() - today.getMonth());
  const months_until_2nd_rent = Math.max(0, monthsDiff);
  const monthly_save_needed =
    second_rent_due / MEMBER_NAMES.length / Math.max(months_until_2nd_rent, 1);

  return {
    total_expenses,
    total_paid,
    total_unpaid,
    per_member_share,
    members,
    annual_budget,
    first_year_total,
    second_rent_due,
    months_until_2nd_rent,
    monthly_save_needed,
  };
}
