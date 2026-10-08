import { useState } from "react";
import { Segmented } from "antd";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";
import { CardListPanel } from "../components/CardListPanel";
import { CardTypePanel } from "../components/CardTypePanel";
import "../components/prepaid-card.css";

type View = "cards" | "types";

/**
 * Thẻ trả trước (/prepaid-card) — function list cụm 3. BlueDental-local: the
 * reference has no prepaid cards; see docs/clone/pages/prepaid-card.md.
 */
export function PrepaidCardPage() {
  const [view, setView] = useState<View>("cards");

  return (
    <div className="reception-page">
      <PageHeader title={t("PrepaidCard:PageTitle")} subtitle={t("PrepaidCard:PageSubtitle")} />
      <Segmented<View>
        className="prepaid-views"
        value={view}
        onChange={setView}
        options={[
          { value: "cards", label: t("PrepaidCard:TabCards") },
          { value: "types", label: t("PrepaidCard:TabTypes") },
        ]}
      />
      {view === "cards" ? <CardListPanel /> : <CardTypePanel />}
    </div>
  );
}
