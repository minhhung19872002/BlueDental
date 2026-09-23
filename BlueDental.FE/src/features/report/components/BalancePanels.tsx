import type { ReactNode } from "react";
import { BankOutlined, CreditCardOutlined, TeamOutlined, WalletOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { CashBalanceDto } from "../api/financeApi";
import { ReportStatCards, type StatTone } from "./ReportStatCards";

interface PanelConfig {
  key: keyof CashBalanceDto;
  label: () => string;
  icon: ReactNode;
  tone: StatTone;
}

const PANELS: PanelConfig[] = [
  { key: "total", label: () => t("Report:Balance:Total"), icon: <WalletOutlined />, tone: "blue" },
  { key: "cash", label: () => t("Report:Balance:TotalCash"), icon: <CreditCardOutlined />, tone: "green" },
  { key: "bank", label: () => t("Report:Balance:TotalBanking"), icon: <BankOutlined />, tone: "gold" },
  { key: "customerPrepaid", label: () => t("Report:Balance:CustomerPrepaidHeld"), icon: <TeamOutlined />, tone: "violet" },
];

interface Props {
  balance: CashBalanceDto | undefined;
}

/** The four holding panels on top of "Luân chuyển dòng tiền V2" — the reference's blue / green / gold / violet. */
export function BalancePanels({ balance }: Props) {
  const items = PANELS.map((panel) => ({
    label: panel.label(),
    value: balance?.[panel.key] ?? 0,
    tone: panel.tone,
    icon: panel.icon,
  }));
  return <ReportStatCards variant="icon" columns={4} items={items} />;
}
