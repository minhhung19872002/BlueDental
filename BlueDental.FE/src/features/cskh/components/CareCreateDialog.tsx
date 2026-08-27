import { useEffect, useState } from "react";
import { Button, DatePicker, Input, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { AppDialog } from "@/components/AppDialog";
import { SearchSelect } from "@/components/SearchSelect/SearchSelect";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useCreateCareRecord, CARE_STATUS } from "../api/careApi";
import { autoSubject, type CareTabConfig } from "../careTabs";
import { MessageField } from "./MessageField";

const QUICK_MONTHS = [3, 6, 9] as const;

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
 */
export function CareCreateDialog({ open, tab, onClose }: CareCreateDialogProps) {
  const branchId = useCurrentBranchId();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [time, setTime] = useState<Dayjs>(dayjs());
  const [patientId, setPatientId] = useState<string | undefined>();
  const [staffId, setStaffId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [patientKeyword, setPatientKeyword] = useState("");

  const staff = useStaffOptions();
  const patients = usePatientOptions(patientKeyword);
  const createCare = useCreateCareRecord();

  useEffect(() => {
    if (!open) return;
    setDate(dayjs());
    setTime(dayjs());
    setPatientId(undefined);
    setStaffId(undefined);
    setNote("");
    setPatientKeyword("");
  }, [open]);

  const handleSave = async () => {
    if (!patientId) return;
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
        dueAt: at,
        scheduledStart: at,
        scheduledEnd: at,
        status: CARE_STATUS.New,
      });
      toast.success(t("Đã tạo công việc chăm sóc"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <AppDialog
      open={open}
      title={t("Tạo công việc mới")}
      width={772}
      canSave={Boolean(patientId)}
      saving={createCare.isPending}
      onSave={handleSave}
      onClose={onClose}
    >
      <div className="bd-form-grid">
        <div className="cskh-message-row cskh-row--datetime">
          <MessageField label={t("Ngày chăm sóc")} hasValue>
            <DatePicker
              allowClear={false}
              format="DD/MM/YYYY"
              value={date}
              onChange={(next) => next && setDate(next)}
            />
          </MessageField>
          <MessageField label={t("Giờ chăm sóc")} hasValue>
            <TimePicker
              allowClear={false}
              format="HH:mm"
              value={time}
              onChange={(next) => next && setTime(next)}
            />
          </MessageField>
        </div>

        <div className="cskh-quick-months">
          {QUICK_MONTHS.map((months) => (
            <Button
              key={months}
              size="small"
              onClick={() => setDate((current) => current.add(months, "month"))}
            >
              {t("+{0} tháng", months)}
            </Button>
          ))}
        </div>

        <div className="cskh-message-row">
          <MessageField label={t("Chọn khách hàng")} required hasValue={Boolean(patientId)}>
            <SearchSelect
              value={patientId}
              options={(patients.data ?? []).map((p) => ({
                value: p.id,
                label: `${p.name} (${p.code})`,
              }))}
              allowClear
              onChange={setPatientId}
              onSearch={setPatientKeyword}
            />
          </MessageField>

          <MessageField label={t("Bác sĩ tiếp nhận")} hasValue={Boolean(staffId)}>
            <SearchSelect
              value={staffId}
              options={staff.data ?? []}
              allowClear
              onChange={setStaffId}
            />
          </MessageField>
        </div>

        <MessageField label={t("Ghi chú lần chăm sóc")} hasValue={Boolean(note)}>
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
