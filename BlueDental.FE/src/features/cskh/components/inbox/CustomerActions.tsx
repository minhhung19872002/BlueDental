import { useMemo, useState } from "react";
import { Button } from "antd";
import { CalendarOutlined, UserAddOutlined } from "@ant-design/icons";
import { AppointmentEditorModal } from "@/features/appointments";
import { PatientEditorDialog } from "@/features/patient-management/components/PatientEditorDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { useInvalidateInbox, useLinkPatient, type ConversationDetail } from "../../api/inboxApi";
import { patientPrefillOf } from "../../inboxLook";

type OpenDialog = "patient" | "appointment" | null;

interface Props {
  conversation: ConversationDetail;
  canHandle: boolean;
  /** "Đổi hồ sơ" is open: the linked record is being replaced, so a new one may be made. */
  relinking: boolean;
  onLinked: () => void;
}

/**
 * [Tạo hồ sơ] [Tạo lịch hẹn] under the record picker (R-1030): the clinic's own
 * dialogs, filled from the chat, and the conversation tied to the patient they
 * save — a booking for an unlinked chat links it to the patient it was made for.
 */
export function CustomerActions({ conversation, canHandle, relinking, onLinked }: Props) {
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const canCreatePatient = useAbility("patient").canCreate;
  const canCreateAppointment = useAbility("appointment").canCreate;
  const link = useLinkPatient();
  const invalidate = useInvalidateInbox();
  const { id, displayName, sharedPhone, customer } = conversation;
  // The conversation is polled; a fresh object each time would wipe what was typed in the dialog.
  const prefill = useMemo(() => patientPrefillOf(displayName, sharedPhone), [displayName, sharedPhone]);

  const showCreatePatient = canHandle && canCreatePatient && (!customer || relinking);
  // Booking for the linked record leaves the conversation alone; booking for an unlinked one links it.
  const showCreateAppointment = canCreateAppointment && (customer != null || canHandle);
  if (!showCreatePatient && !showCreateAppointment) return null;

  const close = () => setOpenDialog(null);
  const linkTo = (patientId: string) => link.mutate({ id, patientId }, { onSuccess: onLinked });

  const handlePatientCreated = (created: PatientDto) => linkTo(created.id);

  const handleAppointmentSaved = ({ patientId }: { patientId: string }) => {
    if (customer) invalidate(id);
    else linkTo(patientId);
  };

  return (
    <div className="ibx-side-actions">
      {showCreatePatient && (
        <Button size="small" icon={<UserAddOutlined />} onClick={() => setOpenDialog("patient")}>
          {t("CSKH:Inbox:Panel:CreatePatient")}
        </Button>
      )}
      {showCreateAppointment && (
        <Button size="small" icon={<CalendarOutlined />} onClick={() => setOpenDialog("appointment")}>
          {t("CSKH:Inbox:Panel:CreateAppointment")}
        </Button>
      )}
      {openDialog === "patient" && (
        <PatientEditorDialog open patient={null} prefill={prefill} onClose={close} onCreated={handlePatientCreated} />
      )}
      {openDialog === "appointment" && (
        <AppointmentEditorModal
          open
          initialPatientId={customer?.patientId}
          lockPatient={customer != null}
          newPatientPrefill={prefill}
          onClose={close}
          onSuccess={handleAppointmentSaved}
        />
      )}
    </div>
  );
}
