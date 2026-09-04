import type { ReactNode } from "react";
import { BankOutlined, CreditCardOutlined, TeamOutlined, WalletOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { CashBalanceVm } from "../types/mock";
import { ReportStatCards, type StatTone } from "./ReportStatCards";

interface PanelConfig {
  key: keyof Omit<CashBalanceVm, "serviceRevenue">;
  label: () => string;
  icon: ReactNode;
  tone: StatTone;
}

const PANELS: PanelConfig[] = [
  { key: "total", label: () => t("Tổng Tiền"), icon: <WalletOutlined />, tone: "ink" },
  { key: "cash", label: () => t("Tổng Tiền Mặt"), icon: <CreditCardOutlined />, tone: "green" },
  { key: "bank", label: () => t("Tổng Chuyển Khoản"), icon: <BankOutlined />, tone: "blue" },
  { key: "customerPrepaid", label: () => t("Đang Giữ Hộ Khách"), icon: <TeamOutlined />, tone: "gold" },
];

interface Props {
  balance: CashBalanceVm | undefined;
}

/** The four holding panels on top of "Luân chuyển dòng tiền V2" — same icon cards as tab 2. */
export function BalancePanels({ balance }: Props) {
  const items = PANELS.map((panel) => ({
    label: panel.label(),
    value: balance?.[panel.key] ?? 0,
    tone: panel.tone,
    icon: panel.icon,
  }));
  return <ReportStatCards variant="icon" columns={4} items={items} />;
}
