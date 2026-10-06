import { PageTabBar } from "@/components/PageTabBar";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";

export type StaffTabKey = "list" | "penalties";

interface Props {
  activeKey: StaffTabKey;
}

/**
 * Danh sách nhân viên | Chế tài — two routes under /staff, each behind its own
 * subject, so a tab the account cannot read is absent rather than refused.
 */
export function StaffTabBar({ activeKey }: Props) {
  const staff = useAbility("staff");
  const penalty = useAbility("staffPenalty");

  const tabs = [
    staff.canRead && { key: "list", label: t("Staff:Tab:List"), to: "/staff" },
    penalty.canRead && { key: "penalties", label: t("Staff:Tab:Penalties"), to: "/staff/penalties" },
  ].filter((tab) => tab !== false);

  if (tabs.length < 2) return null;

  return <PageTabBar className="staff-tabs" label={t("Staff:PageTitle")} activeKey={activeKey} tabs={tabs} />;
}
