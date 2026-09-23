import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import type { RangeQuery } from "../api/clinicReportApi";
import type { SalesSubKey } from "../hooks/useReportUrlState";
import { ServiceSubTab, ServiceSubTabActions } from "./ServiceSubTab";
import { ActualRevenueSubTab, ActualRevenueSubTabActions } from "./ActualRevenueSubTab";
import { PaymentSubTab } from "./PaymentSubTab";
import { RefundSubTab } from "./RefundSubTab";
import { DebtSubTab } from "./DebtSubTab";
import { PrepaidSubTab } from "./PrepaidSubTab";
import { ReportOverviewSection } from "./ReportOverviewSection";

const SUB_FILTERS: { key: SalesSubKey; label: () => string }[] = [
  { key: "service", label: () => t("Report:SubTab:Service") },
  { key: "actual", label: () => t("Report:SubTab:ActualRevenue") },
  { key: "payment", label: () => t("Report:SubTab:Payment") },
  { key: "refund", label: () => t("Report:SubTab:Refund") },
  { key: "debt", label: () => t("Report:SubTab:Debt") },
  { key: "prepaid", label: () => t("Report:SubTab:Prepaid") },
];

/** Doanh số thực, Dư nợ and Tạm ứng are table views: the reference shows no overview charts under them. */
const TABLE_ONLY_SUBS: SalesSubKey[] = ["actual", "debt", "prepaid"];

interface Props extends RangeQuery {
  sub: SalesSubKey;
  onSubChange: (sub: SalesSubKey) => void;
}

function renderExtra(sub: SalesSubKey, range: RangeQuery) {
  if (sub === "service") return <ServiceSubTabActions {...range} />;
  if (sub === "actual") return <ActualRevenueSubTabActions {...range} />;
  return undefined;
}

/** Tab "Doanh số và lượt khách": sub-pills + the shared overview block (hidden on table-only sub tabs). */
export function ExpenseTab({ sub, onSubChange, ...range }: Props) {
  const items = SUB_FILTERS.map((f) => ({ key: f.key, label: f.label() }));

  return (
    <div className="report-tab">
      <PillTabs
        className="report-sub-tabs"
        items={items}
        activeKey={sub}
        onChange={(key) => onSubChange(key as SalesSubKey)}
        extra={renderExtra(sub, range)}
      />

      {sub === "service" && <ServiceSubTab {...range} />}
      {sub === "actual" && <ActualRevenueSubTab {...range} />}
      {sub === "payment" && <PaymentSubTab {...range} />}
      {sub === "refund" && <RefundSubTab {...range} />}
      {sub === "debt" && <DebtSubTab {...range} />}
      {sub === "prepaid" && <PrepaidSubTab {...range} />}

      {!TABLE_ONLY_SUBS.includes(sub) && <ReportOverviewSection range={range} />}
    </div>
  );
}
