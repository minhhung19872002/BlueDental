import { Button } from "antd";
import {
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  PhoneOutlined,
  RollbackOutlined,
  StopOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { TICKET_STATUS, type TicketDto } from "../api/ticketApi";
import { isOpenStatus, isUnbooked } from "./ticketConfig";
import type { TicketRowAction, TicketRowRights } from "./TicketRowActions";

interface Props {
  ticket: TicketDto | undefined;
  rights: TicketRowRights;
  onAction: (action: TicketRowAction, ticket: TicketDto) => void;
}

/**
 * The row's actions as labelled buttons under the detail, with the same rules
 * as TicketRowActions: Xoá alone at the left, the rest at the right, the next
 * step of the care (Đặt lịch hẹn) as the primary one. No Đóng: the corner X
 * closes it, and the footer is busy enough (owner, 2026-10-07).
 */
export function TicketDetailFooter({ ticket, rights, onAction }: Props) {
  const live = ticket && !ticket.isDeleted ? ticket : undefined;
  const open = live ? isOpenStatus(live.status) : false;
  const unbooked = live ? isUnbooked(live.status) : false;
  const fire = (action: TicketRowAction) => () => {
    if (live) onAction(action, live);
  };

  return (
    <div className="bd-modal-foot">
      <div className="bd-min0">
        {live && rights.remove && (
          <Button danger icon={<DeleteOutlined />} onClick={fire("delete")}>
            {t("Common:Delete")}
          </Button>
        )}
      </div>
      <div className="bd-modal-foot-actions mkt-detail-actions">
        {live && rights.update && (
          <Button icon={<EditOutlined />} onClick={fire("edit")}>
            {t("Common:Edit")}
          </Button>
        )}
        {live && rights.transfer && (
          <Button icon={<UserSwitchOutlined />} onClick={fire("assign")}>
            {t("Ticket:Assign")}
          </Button>
        )}
        {rights.update && unbooked && (
          <Button icon={<StopOutlined />} onClick={fire("notPotential")}>
            {t("Ticket:MarkNotPotential")}
          </Button>
        )}
        {live && rights.update && live.status === TICKET_STATUS.NotPotential && (
          <Button icon={<RollbackOutlined />} onClick={fire("reopen")}>
            {t("Ticket:Reopen")}
          </Button>
        )}
        {live && rights.update && open && !live.assigneeId && (
          <Button color="primary" variant="outlined" icon={<UserAddOutlined />} onClick={fire("claim")}>
            {t("Ticket:Claim")}
          </Button>
        )}
        {rights.update && open && (
          <Button color="primary" variant="outlined" icon={<PhoneOutlined />} onClick={fire("contact")}>
            {t("Ticket:LogContact")}
          </Button>
        )}
        {live && unbooked && rights.book(live) && (
          <Button type="primary" icon={<CalendarOutlined />} onClick={fire("book")}>
            {t("Ticket:Book")}
          </Button>
        )}
      </div>
    </div>
  );
}
