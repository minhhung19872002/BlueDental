import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";
import { MarketingTabBar, type MarketingTabKey } from "./MarketingTabBar";

interface Props {
  activeKey: MarketingTabKey;
  children: ReactNode;
}

/**
 * The frame every Marketing screen sits in — the one Labo and Danh mục wear:
 * the pill row, then one pane that fills the rest and scrolls its own table.
 */
export function MarketingShell({ activeKey, children }: Props) {
  return (
    <div className="bd-shell-page">
      <PageHeader title={t("Ticket:PageTitle")} />
      <div className="mkt-page">
        <MarketingTabBar activeKey={activeKey} />
        <div className="mkt-screen">{children}</div>
      </div>
    </div>
  );
}
