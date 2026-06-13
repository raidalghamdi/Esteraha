import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { Settings, Expense, CategorySetting, Summary } from "@shared/schema";
import { updateSettingsSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { Sliders, CalendarCog, AlertTriangle, ListChecks, ChevronDown, Eye, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  fetchSettings,
  updateSettings,
  fetchExpenses,
  fetchCategorySettings,
  setCategoryIncluded,
  setExpenseIncluded,
  getEffectivelyIncluded,
  computeSummary,
  updateCategoryNames,
  createCategory,
  deleteCategory,
} from "@/lib/supabaseQueries";
import { useLanguage } from "@/lib/language-context";
import { formatSAR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const formSchema = updateSettingsSchema;
type FormValues = z.infer<typeof formSchema>;

export default function SettingsPage() {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });
  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: fetchExpenses,
  });
  const { data: categorySettings = [] } = useQuery<CategorySetting[]>({
    queryKey: ["category_settings"],
    queryFn: fetchCategorySettings,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        annual_rent: settings.annual_rent,
        setup_cost: settings.setup_cost,
        monthly_operating: settings.monthly_operating,
        worker_monthly: settings.worker_monthly,
        first_rent_date: settings.first_rent_date,
        second_rent_date: settings.second_rent_date,
        plan_start: settings.plan_start,
        plan_horizon_months: settings.plan_horizon_months,
      });
    }
  }, [settings, form]);

  const save = useMutation({
    mutationFn: (values: FormValues) => updateSettings(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: t("settings_saved"), description: t("settings_subtitle") });
    },
    onError: (err: any) => toast({ title: t("settings_save_failed"), description: err.message, variant: "destructive" }),
  });

  const summary = useMemo<Summary | null>(() => {
    if (!settings) return null;
    return computeSummary(expenses, settings, [], categorySettings);
  }, [expenses, settings, categorySettings]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-10">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="mt-6 h-80 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 md:py-8 lg:py-10 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{t("nav_settings")}</div>
        <h1 className="font-display text-xl font-bold mt-1">{t("settings_title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("settings_subtitle")}</p>
      </div>

      <div className="rounded-xl border border-warning/40 bg-warning/15 text-foreground p-4 flex gap-3 mb-6">
        <AlertTriangle className="h-5 w-5 text-earth-brown shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold">{t("settings_warning_title")}</div>
          <div className="text-muted-foreground">{t("settings_warning_body")}</div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-6" data-testid="form-settings">
          <SectionCard icon={<Sliders className="h-4 w-4" />} title={t("settings_section_costs")} subtitle={t("settings_section_costs_sub")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField name="annual_rent" label={t("settings_annual_rent")} form={form} />
              <NumberField name="setup_cost" label={t("reference_setup_budget")} form={form} />
              <NumberField name="monthly_operating" label={t("settings_monthly_op")} form={form} />
              <NumberField name="worker_monthly" label={t("settings_worker_monthly")} form={form} />
            </div>
          </SectionCard>

          <SectionCard icon={<CalendarCog className="h-4 w-4" />} title={t("settings_section_schedule")} subtitle={t("settings_section_schedule_sub")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <DateField name="first_rent_date" label={t("settings_first_rent")} form={form} />
              <DateField name="second_rent_date" label={t("settings_second_rent")} form={form} />
              <DateField name="plan_start" label={t("settings_plan_start")} form={form} />
              <NumberField name="plan_horizon_months" label={t("settings_plan_horizon")} form={form} />
            </div>
          </SectionCard>

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={save.isPending} data-testid="button-save-settings" className="w-full sm:w-auto min-w-[140px]">
              {save.isPending ? t("btn_saving") : t("btn_save")}
            </Button>
          </div>
        </form>
      </Form>

      {/* ── Category & Expense Inclusion ── */}
      <div className="mt-8">
        <InclusionSection expenses={expenses} categorySettings={categorySettings} summary={summary} />
      </div>

      {/* ── Live preview ── */}
      {summary && (
        <div className="mt-8">
          <LivePreview summary={summary} categorySettings={categorySettings} />
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Inclusion section
// ──────────────────────────────────────────
function InclusionSection({
  expenses,
  categorySettings,
  summary,
}: {
  expenses: Expense[];
  categorySettings: CategorySetting[];
  summary: Summary | null;
}) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();

  const catMutation = useMutation({
    mutationFn: ({ category, included }: { category: string; included: boolean }) =>
      setCategoryIncluded(category, included),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["category_settings"] }),
    onError: (err: any) => toast({ title: t("inclusion_save_failed"), description: err.message, variant: "destructive" }),
  });

  const expMutation = useMutation({
    mutationFn: ({ id, included }: { id: string; included: boolean }) =>
      setExpenseIncluded(id, included),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    onError: (err: any) => toast({ title: t("inclusion_save_failed"), description: err.message, variant: "destructive" }),
  });

  const nameMutation = useMutation({
    mutationFn: ({ category, name_en, name_ar }: { category: string; name_en: string; name_ar: string }) =>
      updateCategoryNames(category, name_en, name_ar),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_settings"] });
      toast({ title: t("cat_name_updated") });
    },
    onError: (err: any) => toast({ title: t("inclusion_save_failed"), description: err.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { category: string; name_en: string; name_ar: string }) =>
      createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_settings"] });
      toast({ title: t("cat_add_success") });
    },
    onError: (err: any) => toast({ title: t("cat_add_error"), description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (category: string) => deleteCategory(category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category_settings"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast({ title: t("cat_delete_success") });
    },
    onError: (err: any) => toast({ title: t("cat_delete_error"), description: err.message, variant: "destructive" }),
  });

  // Add category form state
  const [addKey, setAddKey] = useState("");
  const [addNameEn, setAddNameEn] = useState("");
  const [addNameAr, setAddNameAr] = useState("");

  const subtotals = summary?.category_subtotals ?? [];

  // Expense count per category (for delete guard)
  const expCountByCat: Record<string, number> = {};
  for (const e of expenses) {
    expCountByCat[e.category] = (expCountByCat[e.category] ?? 0) + 1;
  }

  function handleAddCategory() {
    const key = addKey.trim().replace(/\s+/g, " ");
    if (!key || !addNameEn.trim() || !addNameAr.trim()) return;
    createMutation.mutate({ category: key, name_en: addNameEn.trim(), name_ar: addNameAr.trim() });
    setAddKey("");
    setAddNameEn("");
    setAddNameAr("");
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-6 md:p-7 shadow-sm">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border">
        <div className="rounded-md p-2 bg-primary/10 text-primary shrink-0"><ListChecks className="h-4 w-4" /></div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold leading-tight">{t("settings_categories_section")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings_categories_section_sub")}</p>
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
        {t("categories_included_in_budget")}
      </div>

      <div className="space-y-3">
        {subtotals.map((sub) => {
          const catRow = categorySettings.find((c) => c.category === sub.category);
          const hasExpenses = (expCountByCat[sub.category] ?? 0) > 0;
          return (
            <CategoryRow
              key={sub.category}
              subtotal={sub}
              catRow={catRow}
              expenses={expenses.filter((e) => e.category === sub.category)}
              categorySettings={categorySettings}
              hasExpenses={hasExpenses}
              onToggleCategory={(included) => catMutation.mutate({ category: sub.category, included })}
              onToggleExpense={(id, included) => expMutation.mutate({ id, included })}
              onSaveNames={(name_en, name_ar) => nameMutation.mutate({ category: sub.category, name_en, name_ar })}
              isSavingNames={nameMutation.isPending && (nameMutation.variables as any)?.category === sub.category}
              onDeleteCategory={() => deleteMutation.mutate(sub.category)}
              isDeletingCategory={deleteMutation.isPending}
            />
          );
        })}
      </div>

      {/* Add Category Form */}
      <div className="mt-6 pt-5 border-t border-border">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-sm">
            {lang === "ar" ? "إضافة فئة جديدة" : "Add New Category"}
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("cat_key_label")}</label>
            <Input
              placeholder={lang === "ar" ? "مثال: Cleaning" : "e.g. Cleaning"}
              value={addKey}
              onChange={(e) => setAddKey(e.target.value)}
              className="text-sm"
              data-testid="input-add-cat-key"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("cat_name_en")}</label>
            <Input
              placeholder="e.g. Cleaning"
              value={addNameEn}
              onChange={(e) => setAddNameEn(e.target.value)}
              className="text-sm"
              data-testid="input-add-cat-en"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{t("cat_name_ar")}</label>
            <Input
              dir="rtl"
              placeholder="مثال: تنظيف"
              value={addNameAr}
              onChange={(e) => setAddNameAr(e.target.value)}
              className="text-sm"
              data-testid="input-add-cat-ar"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={!addKey.trim() || !addNameEn.trim() || !addNameAr.trim() || createMutation.isPending}
            onClick={handleAddCategory}
            data-testid="button-add-category"
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 me-1.5" />
            )}
            {lang === "ar" ? "إضافة فئة" : "Add Category"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  subtotal,
  catRow,
  expenses,
  categorySettings,
  hasExpenses,
  onToggleCategory,
  onToggleExpense,
  onSaveNames,
  isSavingNames,
  onDeleteCategory,
  isDeletingCategory,
}: {
  subtotal: Summary["category_subtotals"][number];
  catRow: CategorySetting | undefined;
  expenses: Expense[];
  categorySettings: CategorySetting[];
  hasExpenses: boolean;
  onToggleCategory: (included: boolean) => void;
  onToggleExpense: (id: string, included: boolean) => void;
  onSaveNames: (name_en: string, name_ar: string) => void;
  isSavingNames: boolean;
  onDeleteCategory: () => void;
  isDeletingCategory: boolean;
}) {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [editEn, setEditEn] = useState(catRow?.name_en ?? subtotal.category);
  const [editAr, setEditAr] = useState(catRow?.name_ar ?? subtotal.category);
  const [savedFlash, setSavedFlash] = useState(false);
  const catOn = subtotal.included;
  const countWord = subtotal.count === 1 ? t("expense_count_one") : t("expense_count_many");
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const displayLabel = lang === "ar"
    ? (catRow?.name_ar || subtotal.category)
    : (catRow?.name_en || subtotal.category);

  function handleSaveNames() {
    onSaveNames(editEn, editAr);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-background/60 overflow-hidden" data-testid={`category-row-${subtotal.category}`}>
      <div className="flex items-start gap-2 p-3 sm:p-3.5 flex-wrap sm:flex-nowrap">
        <Checkbox
          checked={catOn}
          onCheckedChange={(v) => onToggleCategory(!!v)}
          aria-label={subtotal.category}
          data-testid={`checkbox-category-${subtotal.category}`}
          className="mt-0.5 shrink-0"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center justify-between gap-2 min-w-0 text-start"
          data-testid={`toggle-category-${subtotal.category}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("font-display font-bold truncate", !catOn && "opacity-50")}>{displayLabel}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {subtotal.count} {countWord}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm tabular font-semibold hidden sm:inline" data-testid={`text-included-amount-${subtotal.category}`}>
              {formatSAR(subtotal.included_amount, { decimals: 0 }, lang)} {t("included_word")}
            </span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </div>
        </button>
      </div>

      {!catOn && (
        <div className="px-3.5 pb-2 text-[11px] text-earth-brown">{t("category_off_hint")}</div>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="sr-only">toggle</CollapsibleTrigger>
        <CollapsibleContent>
          {/* Name edit row */}
          <div className="border-t border-border p-3 sm:p-3.5 bg-muted/30">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              {t("edit_cat_name")}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("cat_name_en")}</label>
                <Input
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                  className="text-sm h-8"
                  data-testid={`input-name-en-${subtotal.category}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-muted-foreground mb-0.5 block">{t("cat_name_ar")}</label>
                <Input
                  dir="rtl"
                  value={editAr}
                  onChange={(e) => setEditAr(e.target.value)}
                  className="text-sm h-8"
                  data-testid={`input-name-ar-${subtotal.category}`}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveNames}
                  disabled={isSavingNames}
                  className="h-8 shrink-0"
                  data-testid={`button-save-names-${subtotal.category}`}
                >
                  {isSavingNames ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : savedFlash ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <span className="text-xs">{t("btn_save_short")}</span>
                  )}
                </Button>
                {!hasExpenses && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(lang === "ar" ? `هل تريد حذف فئة "${subtotal.category}"؟` : `Delete category "${subtotal.category}"?`)) {
                        onDeleteCategory();
                      }
                    }}
                    disabled={isDeletingCategory}
                    className="h-8 shrink-0 text-destructive hover:bg-destructive/10 border-destructive/30"
                    title={t("delete_category")}
                    data-testid={`button-delete-cat-${subtotal.category}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {hasExpenses && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    className="h-8 shrink-0 text-muted-foreground border-muted opacity-50 cursor-not-allowed"
                    title={t("cat_cannot_delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            {isSavingNames && (
              <div className="text-[10px] text-muted-foreground mt-1">{t("cat_saving")}</div>
            )}
          </div>

          <div className="border-t border-border divide-y divide-border/60">
            {sorted.length === 0 ? (
              <div className="p-3.5 text-xs text-muted-foreground">{t("expenses_inside_category")}: 0</div>
            ) : (
              sorted.map((e) => {
                const rowChecked = e.included_in_budget !== false;
                const effIncluded = getEffectivelyIncluded(e, categorySettings);
                return (
                  <div
                    key={e.id}
                    className={cn("flex items-center gap-2 p-3 ps-3 sm:ps-9 flex-wrap sm:flex-nowrap", !effIncluded && "opacity-60")}
                    data-testid={`expense-row-${e.id}`}
                  >
                    <Checkbox
                      checked={rowChecked}
                      disabled={!catOn}
                      onCheckedChange={(v) => onToggleExpense(e.id, !!v)}
                      aria-label={e.description}
                      data-testid={`checkbox-expense-${e.id}`}
                    />
                    <div className="text-xs text-muted-foreground w-24 shrink-0 tabular">{formatDate(e.date, lang)}</div>
                    <div className="text-xs font-medium w-16 shrink-0 truncate hidden sm:block">{e.paid_by}</div>
                    <div className="text-sm tabular font-semibold w-20 shrink-0 text-end">
                      {formatSAR(e.amount, { decimals: 0, withSuffix: false }, lang)}
                    </div>
                    <div className="text-sm flex-1 min-w-0 truncate" title={e.description}>
                      {e.description}
                      {!effIncluded && (
                        <span className="ms-2 inline-flex items-center rounded-full bg-muted text-muted-foreground border border-border px-1.5 py-0.5 text-[9px] font-semibold align-middle">
                          {t("excluded_from_category_budget")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ──────────────────────────────────────────
// Live preview
// ──────────────────────────────────────────
function LivePreview({ summary, categorySettings }: { summary: Summary; categorySettings: CategorySetting[] }) {
  const { t, lang } = useLanguage();

  function catDisplayLabel(categoryKey: string) {
    const row = categorySettings.find((c) => c.category === categoryKey);
    if (!row) return categoryKey;
    return lang === "ar" ? (row.name_ar || categoryKey) : (row.name_en || categoryKey);
  }

  return (
    <div className="rounded-2xl border border-primary/30 premium-card p-4 sm:p-6 md:p-7 shadow-sm" data-testid="live-preview">
      <div className="flex items-center gap-2 mb-5">
        <Eye className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">{t("live_preview_title")}</h2>
      </div>

      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {t("included_by_category")}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {summary.category_subtotals.map((s) => (
          <div key={s.category} className="rounded-xl bg-muted/50 border border-border p-3 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 truncate">{catDisplayLabel(s.category)}</div>
            <div className="font-display font-bold text-lg tabular" data-testid={`preview-cat-${s.category}`}>
              {formatSAR(s.included_amount, { decimals: 0, withSuffix: false }, lang)}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-accent/10 border border-accent/30 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t("dynamic_setup_total")}</div>
          <div className="font-display font-bold text-2xl tabular text-accent" data-testid="preview-setup-total">
            {formatSAR(summary.setup_included_total, { decimals: 0 }, lang)}
          </div>
        </div>
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{t("grand_total_all_expenses")}</div>
          <div className="font-display font-bold text-2xl tabular" data-testid="preview-grand-total">
            {formatSAR(summary.grand_total_all, { decimals: 0 }, lang)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5">{t("grand_total_note")}</div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 sm:p-6 md:p-7 shadow-sm">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border">
        <div className="rounded-md p-2 bg-primary/10 text-primary shrink-0">{icon}</div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function NumberField({ name, label, form }: { name: keyof FormValues; label: string; form: any }) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="bg-warning/20 border-warning/40 focus-visible:ring-warning/40 w-full"
              data-testid={`input-${name}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function DateField({ name, label, form }: { name: keyof FormValues; label: string; form: any }) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="date"
              {...field}
              value={field.value ?? ""}
              className="bg-warning/20 border-warning/40 focus-visible:ring-warning/40 w-full"
              data-testid={`input-${name}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
