import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import { REPORT_VIEW_MODES, type ReportViewMode } from "../types/viewMode";

export type ReportTabKey = "sales" | "cashflow" | "result" | "cashflow-v2";

const REPORT_TAB_KEYS: ReportTabKey[] = ["sales", "cashflow", "result", "cashflow-v2"];

/** Older local links used `expense` for the first tab; keep them opening the same view. */
const LEGACY_TAB_ALIASES: Record<string, ReportTabKey> = { expense: "sales" };

/** Sub-pill of the first tab; the reference only writes it for "Doanh số thực" (`real-revenue`). */
export type SalesSubKey = "service" | "actual" | "payment" | "refund" | "debt" | "prepaid";

const SALES_SUB_PARAM_VALUES: Partial<Record<SalesSubKey, string>> = { actual: "real-revenue" };

/** Sub-pill of "Quản lý thu chi"; the reference writes every one of these as `cashflowTab`. */
export type CashflowSubKey = "income" | "expense" | "category";

const CASHFLOW_SUB_KEYS: CashflowSubKey[] = ["income", "expense", "category"];

/** Query-string names the reference uses, so a copied link opens the same view. */
const PARAM = {
  tab: "reportTab",
  mode: "report_dateMode",
  date: "report_date",
  salesSub: "salesTab",
  cashflowSub: "cashflowTab",
} as const;

const DEFAULT_TAB: ReportTabKey = "sales";
const DEFAULT_MODE: ReportViewMode = "day";
const DEFAULT_SALES_SUB: SalesSubKey = "service";
const DEFAULT_CASHFLOW_SUB: CashflowSubKey = "income";
const DATE_FORMAT = "YYYY-MM-DD";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function resolveTab(value: string | null): ReportTabKey {
  if (value === null) return DEFAULT_TAB;
  if (REPORT_TAB_KEYS.includes(value as ReportTabKey)) return value as ReportTabKey;
  return LEGACY_TAB_ALIASES[value] ?? DEFAULT_TAB;
}

function isViewMode(value: string | null): value is ReportViewMode {
  return REPORT_VIEW_MODES.includes(value as ReportViewMode);
}

/** The sub-pill the URL names, if it names one at all. */
function resolveSalesSub(value: string | null): SalesSubKey | undefined {
  return (Object.keys(SALES_SUB_PARAM_VALUES) as SalesSubKey[]).find(
    (key) => SALES_SUB_PARAM_VALUES[key] === value,
  );
}

function resolveCashflowSub(value: string | null): CashflowSubKey {
  return CASHFLOW_SUB_KEYS.find((key) => key === value) ?? DEFAULT_CASHFLOW_SUB;
}

/**
 * Tab, period granularity and anchor date of /report, mirrored into the URL
 * the way the reference does (`reportTab`, `report_dateMode`, `report_date`,
 * `salesTab`, `cashflowTab`). Like the reference, the period (`report_dateMode` + `report_date`)
 * is always written — a plain `/report` becomes `?report_dateMode=day&report_date=<today>`
 * on load — while the default tab and sub-pill are left out.
 */
export function useReportUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = resolveTab(searchParams.get(PARAM.tab));

  const rawMode = searchParams.get(PARAM.mode);
  const hasValidMode = isViewMode(rawMode);
  const viewMode: ReportViewMode = hasValidMode ? rawMode : DEFAULT_MODE;

  const rawDate = searchParams.get(PARAM.date);
  const parsedDate = ISO_DATE.test(rawDate ?? "") ? dayjs(rawDate) : null;
  const hasValidDate = parsedDate?.isValid() === true;
  const currentDate: Dayjs = hasValidDate ? parsedDate : dayjs();

  // Only "Doanh số thực" has a URL value; the other pills live in component state.
  const [localSalesSub, setLocalSalesSub] = useState<SalesSubKey>(DEFAULT_SALES_SUB);
  const salesSub = resolveSalesSub(searchParams.get(PARAM.salesSub)) ?? localSalesSub;
  const cashflowSub = resolveCashflowSub(searchParams.get(PARAM.cashflowSub));

  useEffect(() => {
    if (hasValidMode && hasValidDate) return;
    setSearchParams(
      (params) => {
        params.set(PARAM.mode, viewMode);
        params.set(PARAM.date, currentDate.format(DATE_FORMAT));
        return params;
      },
      { replace: true },
    );
  }, [hasValidMode, hasValidDate, viewMode, currentDate, setSearchParams]);

  const setActiveTab = useCallback(
    (tab: ReportTabKey) => {
      setSearchParams((params) => {
        if (tab === DEFAULT_TAB) params.delete(PARAM.tab);
        else params.set(PARAM.tab, tab);
        if (tab !== DEFAULT_TAB) params.delete(PARAM.salesSub);
        if (tab !== "cashflow") params.delete(PARAM.cashflowSub);
        return params;
      });
      if (tab !== DEFAULT_TAB) setLocalSalesSub(DEFAULT_SALES_SUB);
    },
    [setSearchParams],
  );

  const setViewMode = useCallback(
    (mode: ReportViewMode) => {
      setSearchParams((params) => {
        params.set(PARAM.mode, mode);
        return params;
      });
    },
    [setSearchParams],
  );

  const setCurrentDate = useCallback(
    (date: Dayjs) => {
      setSearchParams((params) => {
        params.set(PARAM.date, date.format(DATE_FORMAT));
        return params;
      });
    },
    [setSearchParams],
  );

  const setSalesSub = useCallback(
    (sub: SalesSubKey) => {
      setLocalSalesSub(sub);
      setSearchParams((params) => {
        const value = SALES_SUB_PARAM_VALUES[sub];
        if (value) params.set(PARAM.salesSub, value);
        else params.delete(PARAM.salesSub);
        return params;
      });
    },
    [setSearchParams],
  );

  const setCashflowSub = useCallback(
    (sub: CashflowSubKey) => {
      setSearchParams((params) => {
        params.set(PARAM.cashflowSub, sub);
        return params;
      });
    },
    [setSearchParams],
  );

  return {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    salesSub,
    setSalesSub,
    cashflowSub,
    setCashflowSub,
  };
}
