import { PageTabBar } from "@/components/PageTabBar";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";

export type MarketingTabKey = "tickets" | "tags" | "deleted";

interface Props {
  activeKey: MarketingTabKey;
}

/**
 * Ticket | Thẻ ticket | Đã xoá — separate routes under /marketing. A tab the
 * account cannot use is absent rather than refused: the deleted list is the
 * delete leaf's, since only it can restore.
 */
export function MarketingTabBar({ activeKey }: Props) {
  const ticket = useAbility("marketingTicket");
  const tag = useAbility("marketingTicketTag");

  const tabs = [
    ticket.canRead && { key: "tickets", label: t("Ticket:Tab:Tickets"), to: "/marketing/tickets" },
    tag.canRead && { key: "tags", label: t("Ticket:Tab:Tags"), to: "/marketing/tags" },
    ticket.canDelete && { key: "deleted", label: t("Ticket:Tab:Deleted"), to: "/marketing/deleted" },
  ].filter((tab) => tab !== false);

  if (tabs.length < 2) return null;

  return <PageTabBar label={t("Menu:Marketing")} activeKey={activeKey} tabs={tabs} />;
}
