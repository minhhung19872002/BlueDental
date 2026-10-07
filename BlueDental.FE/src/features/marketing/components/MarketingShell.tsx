import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { t } from "@/lib/i18n";
import { MarketingTabBar, type MarketingTabKey } from "./MarketingTabBar";

interface Props {
  activeKey: MarketingTabKey;
  /** i18n key — each tab says what it holds. */
  subtitle: string;
  children: ReactNode;
}

/**
 * The frame every Marketing screen sits in — the one Labo and Danh mục wear:
 * page header, the pill row, then one pane that fills the rest and scrolls
 * its own table.
 */
export function MarketingShell({ activeKey, subtitle, children }: Props) {
  return (
    <div className="bd-shell-page">
      <PageHeader title={t("Ticket:PageTitle")} subtitle={t(subtitle)} />
      <div className="mkt-page">
        <MarketingTabBar activeKey={activeKey} />
        <div className="mkt-screen">{children}</div>
      </div>
    </div>
  );
}
