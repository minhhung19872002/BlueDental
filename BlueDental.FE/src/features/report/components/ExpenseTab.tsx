import { useState } from "react";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import type { RangeQuery } from "../api/reportMockQueries";
import { ServiceSubTab, ServiceSubTabActions } from "./ServiceSubTab";
import { PaymentSubTab } from "./PaymentSubTab";
import { RefundSubTab } from "./RefundSubTab";
import { DebtSubTab } from "./DebtSubTab";
import { ReportOverviewSection } from "./ReportOverviewSection";

type SubKey = "service" | "payment" | "refund" | "debt";

const SUB_FILTERS: { key: SubKey; label: () => string }[] = [
  { key: "service", label: () => t("Khách hàng phát sinh dịch vụ") },
  { key: "payment", label: () => t("Thanh toán") },
  { key: "refund", label: () => t("Hoàn tiền") },
  { key: "debt", label: () => t("Dư nợ") },
];

/** Tab "Doanh số và lượt khách": sub-pills + the shared overview block (hidden on Dư nợ). */
export function ExpenseTab(range: RangeQuery) {
  const [sub, setSub] = useState<SubKey>("service");

  const items = SUB_FILTERS.map((f) => ({ key: f.key, label: f.label() }));

  return (
    <div className="report-tab">
      <PillTabs
        className="report-sub-tabs"
        items={items}
        activeKey={sub}
        onChange={(key) => setSub(key as SubKey)}
        extra={sub === "service" ? <ServiceSubTabActions {...range} /> : undefined}
      />

      {sub === "service" && <ServiceSubTab {...range} />}
      {sub === "payment" && <PaymentSubTab {...range} />}
      {sub === "refund" && <RefundSubTab {...range} />}
      {sub === "debt" && <DebtSubTab {...range} />}

      {sub !== "debt" && <ReportOverviewSection range={range} />}
    </div>
  );
}
