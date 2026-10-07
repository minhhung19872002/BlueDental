import { Button, Dropdown, type MenuProps } from "antd";
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  PhoneOutlined,
  RollbackOutlined,
  StopOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import { TICKET_STATUS, type TicketDto } from "../api/ticketApi";
import { isOpenStatus, isUnbooked } from "./ticketConfig";

/** What a row may offer, decided once per screen from the account's leaves and branch. */
export interface TicketRowRights {
  update: boolean;
  transfer: boolean;
  remove: boolean;
  /** appointment.create too, and only on the screen's own branch (Marketing:0012). */
  book: (ticket: TicketDto) => boolean;
}

export type TicketRowAction = "contact" | "claim" | "book" | "assign" | "edit" | "notPotential" | "reopen" | "delete";

interface Props {
  ticket: TicketDto;
  rights: TicketRowRights;
  onAction: (action: TicketRowAction, ticket: TicketDto) => void;
}

/**
 * Gọi / Nhận / Đặt lịch as icons, the rest under "…". Every button is offered
 * only where the server would accept it, so a click is never refused for the
 * ticket's state — only for a race with another user.
 */
export function TicketRowActions({ ticket, rights, onAction }: Props) {
  const open = isOpenStatus(ticket.status);
  const unbooked = isUnbooked(ticket.status);
  const canClaim = rights.update && open && !ticket.assigneeId;

  const menu: MenuProps["items"] = [
    rights.update && { key: "edit", icon: <EditOutlined />, label: t("Common:Edit") },
    rights.transfer && { key: "assign", icon: <UserSwitchOutlined />, label: t("Ticket:Assign") },
    rights.update && unbooked && { key: "notPotential", icon: <StopOutlined />, label: t("Ticket:MarkNotPotential") },
    rights.update &&
      ticket.status === TICKET_STATUS.NotPotential && { key: "reopen", icon: <RollbackOutlined />, label: t("Ticket:Reopen") },
    rights.remove && { key: "delete", icon: <DeleteOutlined />, label: t("Common:Delete"), danger: true },
  ].filter((item) => item !== false);

  const fire = (action: TicketRowAction) => () => onAction(action, ticket);
  const handleMenuClick: NonNullable<MenuProps["onClick"]> = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    onAction(menuAction(key), ticket);
  };

  return (
    <div className="bd-cat-rowactions" onClick={(e) => e.stopPropagation()}>
      {canClaim && (
        <ActionTooltip className="mkt-tip" title={t("Ticket:Claim")}>
          <Button type="text" size="small" aria-label={t("Ticket:Claim")} icon={<UserAddOutlined />} onClick={fire("claim")} />
        </ActionTooltip>
      )}
      {rights.update && open && (
        <ActionTooltip className="mkt-tip" title={t("Ticket:LogContact")}>
          <Button type="text" size="small" aria-label={t("Ticket:LogContact")} icon={<PhoneOutlined />} onClick={fire("contact")} />
        </ActionTooltip>
      )}
      {unbooked && rights.book(ticket) && (
        <ActionTooltip className="mkt-tip" title={t("Ticket:Book")}>
          <Button type="text" size="small" aria-label={t("Ticket:Book")} icon={<CalendarOutlined />} onClick={fire("book")} />
        </ActionTooltip>
      )}
      {menu.length > 0 && (
        <Dropdown trigger={["click"]} menu={{ items: menu, onClick: handleMenuClick }}>
          <Button type="text" size="small" aria-label={t("Common:More")} icon={<MoreOutlined />} />
        </Dropdown>
      )}
    </div>
  );
}

const MENU_ACTIONS: readonly TicketRowAction[] = ["edit", "assign", "notPotential", "reopen", "delete"];

function menuAction(key: string): TicketRowAction {
  return MENU_ACTIONS.find((action) => action === key) ?? "edit";
}
