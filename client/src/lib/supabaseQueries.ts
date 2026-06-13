/**
 * All Supabase data access helpers used by React Query.
 * Each function can be used as a queryFn.
 */

import { supabase } from "./supabase";
import type { Member, Settings, Expense, Summary, SummaryMember, CategorySetting, CategorySubtotal } from "@shared/schema";
import { MEMBER_NAMES } from "@shared/schema";

// ──────────────────────────────────────────
// Types for new tables
// ──────────────────────────────────────────
export interface Contribution {
  id: string;
  member_name: string;
  month: string; // YYYY-MM
  amount: number;
  payment_method: string;
  receipt_url: string;
  receipt_filename: string | null;
  notes: string | null;
  status: "Pending" | "Approved" | "Rejected";
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Governance {
  id: number;
  budget_controller: string;
  esteraha_prince: string;
  charter_text: string | null;
  charter_accepted_by: string | null;
  updated_at: string | null;
}

export type GovernanceField = "budget_controller" | "esteraha_prince" | "charter_text";

export interface GovernanceChange {
  id: string;
  field: GovernanceField;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  note: string | null;
}

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

export async function setExpenseIncluded(id: string, included: boolean): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .update({ included_in_budget: included })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────
// Category settings (per-category inclusion)
// ──────────────────────────────────────────
export async function fetchCategorySettings(): Promise<CategorySetting[]> {
  const { data, error } = await supabase
    .from("category_settings")
    .select("category, included, name_en, name_ar, sort_order, updated_at")
    .order("sort_order", { ascending: true })
    .order("category", { ascending: true });
  if (error) {
    console.warn("fetchCategorySettings:", error.message);
    return [];
  }
  return (data ?? []) as CategorySetting[];
}

export async function setCategoryIncluded(category: string, included: boolean): Promise<void> {
  const { error } = await supabase
    .from("category_settings")
    .update({ included, updated_at: new Date().toISOString() })
    .eq("category", category);
  if (error) throw new Error(error.message);
}

export async function updateCategoryNames(
  category: string,
  name_en: string,
  name_ar: string,
): Promise<void> {
  const { error } = await supabase
    .from("category_settings")
    .update({ name_en, name_ar, updated_at: new Date().toISOString() })
    .eq("category", category);
  if (error) throw new Error(error.message);
}

export async function createCategory(payload: {
  category: string;
  name_en: string;
  name_ar: string;
  sort_order?: number;
}): Promise<void> {
  const key = payload.category.trim().replace(/\s+/g, " ");
  if (!key) throw new Error("Category key cannot be empty");

  // If sort_order not provided, compute max + 1
  let sort_order = payload.sort_order;
  if (sort_order === undefined) {
    const { data: existing } = await supabase
      .from("category_settings")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1);
    const maxSort = (existing?.[0] as any)?.sort_order ?? 0;
    sort_order = maxSort + 1;
  }

  const { error } = await supabase.from("category_settings").insert({
    category: key,
    included: true,
    name_en: payload.name_en,
    name_ar: payload.name_ar,
    sort_order,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteCategory(category: string): Promise<void> {
  // Check that no expenses use this category
  const { data: exps, error: checkErr } = await supabase
    .from("expenses")
    .select("id")
    .eq("category", category)
    .limit(1);
  if (checkErr) throw new Error(checkErr.message);
  if ((exps ?? []).length > 0) {
    throw new Error("Cannot delete: category has expenses");
  }
  const { error } = await supabase
    .from("category_settings")
    .delete()
    .eq("category", category);
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────
// Contributions
// ──────────────────────────────────────────
export async function fetchContributions(): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contribution[];
}

export async function fetchContributionsByMember(memberName: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .eq("member_name", memberName)
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contribution[];
}

export async function fetchPendingContributions(): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from("contributions")
    .select("*")
    .eq("status", "Pending")
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contribution[];
}

export async function insertContribution(contribution: Omit<Contribution, "id" | "submitted_at" | "reviewed_at" | "reviewed_by" | "rejection_reason">): Promise<Contribution> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from("contributions")
    .insert({ ...contribution, id, submitted_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Contribution;
}

export async function approveContribution(id: string, reviewedBy: string): Promise<void> {
  const { error } = await supabase
    .from("contributions")
    .update({
      status: "Approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function rejectContribution(id: string, reviewedBy: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("contributions")
    .update({
      status: "Rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      rejection_reason: reason,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────
// Governance
// ──────────────────────────────────────────
export async function fetchGovernance(): Promise<Governance> {
  const { data, error } = await supabase
    .from("governance")
    .select("*")
    .eq("id", 1)
    .single();
  // If governance table doesn't exist yet, return defaults
  if (error) {
    return {
      id: 1,
      budget_controller: "Raid",
      esteraha_prince: "Raid",
      charter_text: null,
      charter_accepted_by: null,
      updated_at: null,
    };
  }
  return data as Governance;
}

// ──────────────────────────────────────────
// Governance Changes (audit log)
// ──────────────────────────────────────────
export async function fetchGovernanceChanges(limit = 10): Promise<GovernanceChange[]> {
  const { data, error } = await supabase
    .from("governance_changes")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("fetchGovernanceChanges:", error.message);
    return [];
  }
  return (data ?? []) as GovernanceChange[];
}

export async function updateGovernanceField(
  field: GovernanceField,
  newValue: string,
  changedBy: string,
  oldValue: string | null,
  note?: string,
): Promise<void> {
  // Insert audit row first (id is BIGSERIAL — let the DB assign it)
  const { error: insertErr } = await supabase.from("governance_changes").insert({
    field,
    old_value: oldValue,
    new_value: newValue,
    changed_by: changedBy,
    changed_at: new Date().toISOString(),
    note: note ?? null,
  });
  if (insertErr) throw new Error(insertErr.message);

  // Then update governance row
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  patch[field] = newValue;
  const { error: updateErr } = await supabase
    .from("governance")
    .update(patch)
    .eq("id", 1);
  if (updateErr) throw new Error(updateErr.message);
}

// ──────────────────────────────────────────
// Receipt attach (existing expenses + contributions)
// ──────────────────────────────────────────
export async function uploadReceiptFile(file: File, folder: "expenses" | "contributions"): Promise<{ publicUrl: string; filename: string }> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large (max 5MB)");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type });
  if (uploadErr) throw new Error(uploadErr.message);
  const { data: pub } = supabase.storage.from("receipts").getPublicUrl(path);
  return { publicUrl: pub.publicUrl, filename: file.name };
}

export async function attachReceiptToExpense(expenseId: string, publicUrl: string, filename: string): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .update({ receipt_url: publicUrl, receipt_filename: filename })
    .eq("id", expenseId);
  if (error) throw new Error(error.message);
}

export async function attachReceiptToContribution(contributionId: string, publicUrl: string, filename: string): Promise<void> {
  const { error } = await supabase
    .from("contributions")
    .update({ receipt_url: publicUrl, receipt_filename: filename })
    .eq("id", contributionId);
  if (error) throw new Error(error.message);
}

// ──────────────────────────────────────────
// Inclusion helper (v4)
// ──────────────────────────────────────────
// An expense counts toward BUDGET-side computations only when:
//   - it is approved (expenses have no approval workflow → status !== 'Rejected'
//     and approval_status is 'Approved' or null/undefined)
//   - its own included_in_budget flag is true
//   - its category's category_settings.included is true
export function getEffectivelyIncluded(
  expense: Expense,
  categorySettings: CategorySetting[] = []
): boolean {
  const approvalStatus = (expense as any).approval_status as string | null | undefined;
  const approved = approvalStatus == null || approvalStatus === "Approved";
  if (!approved) return false;
  if (expense.included_in_budget === false) return false;
  const cat = categorySettings.find((c) => c.category === expense.category);
  // If no row for the category, treat it as included (default true)
  if (cat && cat.included === false) return false;
  return true;
}

function categoryIncluded(category: string, categorySettings: CategorySetting[]): boolean {
  const cat = categorySettings.find((c) => c.category === category);
  return cat ? cat.included !== false : true;
}

// ──────────────────────────────────────────
// Summary (computed client-side)
// ──────────────────────────────────────────
export function computeSummary(
  expenses: Expense[],
  settings: Settings,
  approvedContributions: Contribution[] = [],
  categorySettings: CategorySetting[] = []
): Summary {
  // ── Grand total: ALL recorded expenses, independent of inclusion ──
  const total_expenses = expenses.reduce((s, e) => s + e.amount, 0);
  const grand_total_all = total_expenses;
  const total_paid = expenses
    .filter((e) => e.status === "Paid")
    .reduce((s, e) => s + e.amount, 0);
  const total_unpaid = expenses
    .filter((e) => e.status === "Unpaid")
    .reduce((s, e) => s + e.amount, 0);

  // ── Budget side: only effectively-included expenses ──
  const includedExpenses = expenses.filter((e) => getEffectivelyIncluded(e, categorySettings));
  const included_total = includedExpenses.reduce((s, e) => s + e.amount, 0);
  const setup_included_total = includedExpenses
    .filter((e) => e.category === "Setup")
    .reduce((s, e) => s + e.amount, 0);

  // Per-category subtotals — dynamically built from loaded category_settings
  // We include any category that appears in either expenses OR category_settings
  const allCategoryKeys = Array.from(new Set([
    ...categorySettings.map((cs) => cs.category),
    ...expenses.map((e) => e.category),
  ]));

  // Sort by sort_order (from category_settings), then alphabetically
  allCategoryKeys.sort((a, b) => {
    const aRow = categorySettings.find((c) => c.category === a);
    const bRow = categorySettings.find((c) => c.category === b);
    const aSort = aRow?.sort_order ?? 9999;
    const bSort = bRow?.sort_order ?? 9999;
    if (aSort !== bSort) return aSort - bSort;
    return a.localeCompare(b);
  });

  const category_subtotals: CategorySubtotal[] = allCategoryKeys.map((category) => {
    const inCat = expenses.filter((e) => e.category === category);
    const included = categoryIncluded(category, categorySettings);
    const effIncluded = inCat.filter((e) => getEffectivelyIncluded(e, categorySettings));
    return {
      category,
      included,
      count: inCat.length,
      included_count: effIncluded.length,
      excluded_count: inCat.length - effIncluded.length,
      included_amount: effIncluded.reduce((s, e) => s + e.amount, 0),
      total_amount: inCat.reduce((s, e) => s + e.amount, 0),
    };
  });

  // Per-member "total paid" / "who paid what" KPIs use ALL approved expenses
  // regardless of inclusion (kept under the grand total of everything).
  const per_member_share = total_paid / MEMBER_NAMES.length;

  const members: SummaryMember[] = MEMBER_NAMES.map((name) => {
    // Direct expenses paid by this member (ALL paid, inclusion-independent)
    const directPaid = expenses
      .filter((e) => e.status === "Paid" && e.paid_by === name)
      .reduce((s, e) => s + e.amount, 0);
    // Approved monthly contributions by this member
    const contributionsPaid = approvedContributions
      .filter((c) => c.status === "Approved" && c.member_name === name)
      .reduce((s, c) => s + c.amount, 0);
    const paid = directPaid + contributionsPaid;
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
  // First-year total uses the dynamic (inclusion-based) Setup total when there
  // are recorded Setup expenses, otherwise falls back to the reference setup_cost.
  const dynamicSetup = setup_included_total > 0 ? setup_included_total : settings.setup_cost;
  const first_year_total = annual_budget + dynamicSetup;

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
    grand_total_all,
    included_total,
    setup_included_total,
    category_subtotals,
  };
}

// ──────────────────────────────────────────
// Monthly contribution target (from settings)
// ──────────────────────────────────────────
export function computeMonthlyTarget(settings: Settings): number {
  const annual_budget =
    settings.annual_rent +
    settings.setup_cost +
    (settings.monthly_operating + settings.worker_monthly) * 12;
  return Math.round(annual_budget / 9 / 12);
}

// ──────────────────────────────────────────
// Category label helper
// ──────────────────────────────────────────
export function categoryLabel(
  categoryKey: string,
  lang: "ar" | "en",
  categorySettings: CategorySetting[]
): string {
  const row = categorySettings.find((c) => c.category === categoryKey);
  if (!row) return categoryKey;
  return lang === "ar" ? (row.name_ar || categoryKey) : (row.name_en || categoryKey);
}
