import { useEffect, useState } from "react";
import { DatePicker, Input, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { AppDialog } from "@/components/AppDialog";
import { PatientSearchSelect, SearchSelect } from "@/components/SearchSelect";
import { useDentistStaffOptions, useStaffOptions } from "@/hooks/useStaffOptions";
import type { PatientOption } from "@/hooks/usePatientOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useCreateCareRecord, CARE_STATUS, CARE_TYPE } from "../api/careApi";
import { autoSubject, type CareTabConfig } from "../careTabs";
import { CareQuickMonths } from "./CareQuickMonths";
import { MessageField } from "./MessageField";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";

const patientLabel = (p: PatientOption) => `${p.name} (${p.code})`;

interface CareCreateDialogProps {
  open: boolean;
  tab: CareTabConfig;
  onClose: () => void;
}

/**
 * "Tạo công việc mới" of the Tạo mới button (periodic & special, identical):
 * date + time now, +3/+6/+9 tháng quick buttons, patient combobox, receiving
 * doctor, note. The reference posts dateTime = scheduleStartTime =
 * scheduleToTime with status "new" and an auto subject.
 *
 * Complain (bug list #16) files through the same dialog: no quick months, a
 * responsible staff member, and the complaint itself is required.
 */
export function CareCreateDialog({ open, tab, onClose }: CareCreateDialogProps) {
  const branchId = useCurrentBranchId();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [time, setTime] = useState<Dayjs>(dayjs());
  const [patientId, setPatientId] = useState<string | undefined>();
  const [staffId, setStaffId] = useState<string | undefined>();
  const [careStaffId, setCareStaffId] = useState<string | undefined>();
  const [note, setNote] = useState("");

  const isComplaint = tab.type === CARE_TYPE.Complaint;
  const dentists = useDentistStaffOptions();
  const staff = useStaffOptions();
  const createCare = useCreateCareRecord();

  useEffect(() => {
    if (!open) return;
    setDate(dayjs());
    setTime(dayjs());
    setPatientId(undefined);
    setStaffId(undefined);
    setCareStaffId(undefined);
    setNote("");
  }, [open]);

  const handleSave = async () => {
    if (!patientId || !canSave) return;
    const at = date
      .hour(time.hour())
      .minute(time.minute())
      .second(0)
      .millisecond(0)
      .toISOString();
    try {
      await createCare.mutateAsync({
        patientId,
        branchId,
        type: tab.type,
        subject: autoSubject(tab.type),
        description: note || undefined,
        assignedStaffId: staffId,
        careStaffId: isComplaint ? careStaffId : undefined,
        dueAt: at,
        scheduledStart: at,
        scheduledEnd: at,
        status: CARE_STATUS.New,
      });
      toast.success(t("CSKH:CreatedTask"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const canSave = Boolean(patientId) && (!isComplaint || note.trim().length > 0);

  return (
    <AppDialog
      open={open}
      title={t("CSKH:CreateTaskTitle")}
      width={772}
      canSave={canSave}
      saving={createCare.isPending}
      onSave={handleSave}
      onClose={onClose}
    >
      <div className="bd-form-grid">
        <div className="cskh-message-row cskh-row--datetime">
          <MessageField label={isComplaint ? t("CSKH:ReceivedAt") : t("CSKH:CareDate")} hasValue>
            <DatePicker
              allowClear={false}
              format={DATE_INPUT_FORMAT}
              value={date}
              onChange={(next) => next && setDate(next)}
            />
          </MessageField>
          <MessageField label={t("CSKH:TimeLabel")} hasValue>
            <TimePicker
              allowClear={false}
              format="HH:mm"
              value={time}
              onChange={(next) => next && setTime(next)}
            />
          </MessageField>
        </div>

        {!isComplaint && <CareQuickMonths onShift={setDate} />}

        <div className="cskh-message-row">
          <MessageField label={t("CSKH:SelectCustomer")} required hasValue={Boolean(patientId)}>
            <PatientSearchSelect
              value={patientId}
              formatLabel={patientLabel}
              allowClear
              onChange={setPatientId}
            />
          </MessageField>

          <MessageField label={t("CSKH:DoctorReceive")} hasValue={Boolean(staffId)}>
            <SearchSelect
              value={staffId}
              options={dentists.data ?? []}
              allowClear
              onChange={setStaffId}
            />
          </MessageField>
        </div>

        {isComplaint && (
          <MessageField label={t("CSKH:ResponsibleStaff")} hasValue={Boolean(careStaffId)}>
            <SearchSelect
              value={careStaffId}
              options={staff.data ?? []}
              allowClear
              onChange={setCareStaffId}
            />
          </MessageField>
        )}

        <MessageField
          label={isComplaint ? t("CSKH:Col:ComplaintContent") : t("CSKH:NoteLabel")}
          required={isComplaint}
          hasValue={Boolean(note)}
        >
          <Input.TextArea
            rows={6}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </MessageField>
      </div>
    </AppDialog>
  );
}
