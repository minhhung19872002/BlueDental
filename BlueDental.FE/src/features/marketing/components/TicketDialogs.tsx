import { DeleteOutlined, StopOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { StaffOption, TicketTagDto } from "../api/ticketSupportApi";
import type { useTicketActions } from "../hooks/useTicketActions";
import type { useSourceOptions } from "../hooks/useSourceOptions";
import { AssignDialog } from "./AssignDialog";
import { BookAppointmentDialog } from "./BookAppointmentDialog";
import { ContactDialog } from "./ContactDialog";
import { ReasonDialog } from "./ReasonDialog";
import { TicketDialog } from "./TicketDialog";

interface Props {
  actions: ReturnType<typeof useTicketActions>;
  tags: TicketTagDto[];
  sources: ReturnType<typeof useSourceOptions>;
  staffOptions: StaffOption[];
  /** marketingTicket.transfer: may name the assignee on Tạo ticket. */
  canTransfer: boolean;
}

/** Every dialog the Ticket screen opens; which one shows is the actions' pending state. */
export function TicketDialogs({ actions, tags, sources, staffOptions, canTransfer }: Props) {
  const { pending, target, busy } = actions;
  const subtitle = target ? `${target.fullName} · ${target.phone}` : "";

  return (
    <>
      <TicketDialog
        open={pending.kind === "form"}
        ticket={pending.kind === "form" ? pending.ticket : null}
        tags={tags}
        sources={sources}
        staffOptions={canTransfer ? staffOptions : undefined}
        saving={actions.saving}
        onSubmit={actions.submitForm}
        onClose={actions.close}
      />
      <ContactDialog
        open={pending.kind === "contact"}
        subtitle={subtitle}
        pending={busy.contact}
        onSubmit={actions.submitContact}
        onClose={actions.close}
      />
      <AssignDialog
        open={pending.kind === "assign"}
        subtitle={subtitle}
        currentAssigneeId={target?.assigneeId ?? null}
        currentAssigneeName={target?.assigneeName ?? null}
        staffOptions={staffOptions}
        pending={busy.assign}
        onSubmit={actions.submitAssign}
        onClose={actions.close}
      />
      <ReasonDialog
        open={pending.kind === "notPotential"}
        title={t("Ticket:MarkNotPotential")}
        subtitle={subtitle}
        label={t("Ticket:Field:NotPotentialReason")}
        note={t("Ticket:NotPotentialNote")}
        confirmLabel={t("Ticket:MarkNotPotential")}
        confirmIcon={<StopOutlined />}
        pending={busy.reason}
        onConfirm={actions.submitReason}
        onClose={actions.close}
      />
      <ReasonDialog
        open={pending.kind === "delete"}
        title={t("Ticket:Delete")}
        subtitle={subtitle}
        label={t("Ticket:Field:DeleteReason")}
        note={t("Ticket:DeleteNote")}
        confirmLabel={t("Common:Delete")}
        confirmIcon={<DeleteOutlined />}
        pending={busy.reason}
        onConfirm={actions.submitReason}
        onClose={actions.close}
      />
      <BookAppointmentDialog
        ticket={pending.kind === "book" ? pending.ticket : null}
        pending={busy.book}
        onSubmit={actions.submitBook}
        onClose={actions.close}
      />
    </>
  );
}
