import { useEffect, useState } from "react";
import { DatePicker, Input } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { AppDialog } from "@/components/AppDialog";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import {
  CARE_OUTCOME,
  CARE_STATUS,
  CARE_TYPE,
  useCreateCareRecord,
  type CareOutcome,
} from "../api/careApi";
import { MessageField } from "./MessageField";

/** Nhãn màu radios in the reference's order and palette. */
const OUTCOME_OPTIONS: Array<{ value: CareOutcome; className: string; label: () => string }> = [
  { value: CARE_OUTCOME.Good, className: "cskh-color-radio--good", label: () => t("Tốt") },
  { value: CARE_OUTCOME.Fair, className: "cskh-color-radio--fair", label: () => t("Khá") },
  { value: CARE_OUTCOME.Normal, className: "cskh-color-radio--normal", label: () => t("Bình thường") },
  { value: CARE_OUTCOME.Complaint, className: "cskh-color-radio--complaint", label: () => t("Khiếu nại") },
];

interface BaseCareDialogProps {
  open: boolean;
  patient: { id: string; code: string; name: string } | null;
  onClose: () => void;
}

/**
 * File-heart dialog of the Phân nhóm CSKH tab. The reference posts a `base`
 * task with status success, dateTime at the chosen date (current time) and
 * scheduleToTime one hour later.
 */
export function BaseCareDialog({ open, patient, onClose }: BaseCareDialogProps) {
  const branchId = useCurrentBranchId();
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<CareOutcome>(CARE_OUTCOME.NotRated);
  const createCare = useCreateCareRecord();

  useEffect(() => {
    if (!open) return;
    setDate(dayjs());
    setTitle("");
    setNote("");
    setOutcome(CARE_OUTCOME.NotRated);
  }, [open]);

  const handleSave = async () => {
    if (!patient || !title.trim()) return;
    const now = dayjs();
    const start = date.hour(now.hour()).minute(now.minute()).second(0).millisecond(0);
    try {
      await createCare.mutateAsync({
        patientId: patient.id,
        branchId,
        type: CARE_TYPE.Base,
        subject: title.trim(),
        description: note || undefined,
        status: CARE_STATUS.Succeeded,
        outcome,
        dueAt: start.toISOString(),
        scheduledStart: start.toISOString(),
        scheduledEnd: start.add(1, "hour").toISOString(),
      });
      toast.success(t("Đã lưu lần chăm sóc"));
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
      canSave={Boolean(patient && title.trim())}
      saving={createCare.isPending}
      onSave={handleSave}
      onClose={onClose}
    >
      {patient && (
        <div className="bd-form-grid">
          <div className="cskh-message-row">
            <MessageField label={t("Ngày")} hasValue>
              <DatePicker
                allowClear={false}
                format="DD/MM/YYYY"
                value={date}
                onChange={(next) => next && setDate(next)}
              />
            </MessageField>

            <MessageField label={t("Tiêu đề")} required hasValue={Boolean(title)}>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </MessageField>
          </div>

          <MessageField label={t("Ghi chú lần chăm sóc")} hasValue={Boolean(note)}>
            <Input.TextArea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </MessageField>

          <div className="cskh-label-row">
            <span>{t("Nhãn màu")}</span>
            <div className="cskh-color-options">
              {OUTCOME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={outcome === option.value}
                  className={[
                    "cskh-color-radio",
                    option.className,
                    outcome === option.value && "cskh-color-radio--checked",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setOutcome(option.value)}
                >
                  <span className="cskh-color-dot" />
                  {option.label()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppDialog>
  );
}
