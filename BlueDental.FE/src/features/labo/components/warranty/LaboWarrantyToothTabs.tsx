import { useState } from "react";
import { Segmented } from "antd";
import { t } from "@/lib/i18n";
import { LaboWarrantyCardInfo, type LaboWarrantyCardFacts } from "./LaboWarrantyCardInfo";
import { LaboWarrantyHistory } from "./LaboWarrantyHistory";

type ToothTab = "info" | "history";

/** "Răng 21" with Thông tin thẻ / Lịch sử for the card picked above. */
export function LaboWarrantyToothTabs(facts: LaboWarrantyCardFacts) {
  const [tab, setTab] = useState<ToothTab>("info");
  return (
    <section className="pd-labo-check-section" aria-label={t("Labo:Check:ToothLabel", facts.tooth.toothNumber)}>
      <header className="pd-labo-check-head">
        <h3>{t("Labo:Check:ToothLabel", facts.tooth.toothNumber)}</h3>
        <Segmented<ToothTab>
          size="small"
          value={tab}
          onChange={setTab}
          options={[
            { value: "info", label: t("Labo:Warranty:Tab:Info") },
            { value: "history", label: t("Labo:Warranty:Tab:History") },
          ]}
        />
      </header>
      {tab === "info" ? <LaboWarrantyCardInfo {...facts} /> : <LaboWarrantyHistory tooth={facts.tooth} code={facts.code} />}
    </section>
  );
}
