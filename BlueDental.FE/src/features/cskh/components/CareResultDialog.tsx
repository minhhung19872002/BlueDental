import { useEffect, useState } from "react";
import { Input } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { AppDialog } from "@/components/AppDialog";
import {
  CARE_STATUS,
  useUpdateCareRecord,
  type CareRecordDto,
  type CareStatus,
} from "../api/careApi";
import type { CareTabConfig } from "../careTabs";
import { CarePatientLine } from "./CarePatientLine";
import { MessageField } from "./MessageField";

interface CareResultDialogProps {
  open: boolean;
  tab: CareTabConfig;
  record: CareRecordDto | null;
  onClose: () => void;
}

const RESULT_CHOICES: Array<{ value: CareStatus; label: () => string }> = [
  { value: CARE_STATUS.Succeeded, label: () => t("Thành công") },
  { value: CARE_STATUS.Failed, label: () => t("Thất bại") },
];

/**
 * File-heart dialog of the care tabs (except Sau điều trị): pick Thành công /
 * Thất bại, edit the note, save via the same full-object PUT the reference uses.
 */
export function CareResultDialog({ open, tab, record, onClose }: CareResultDialogProps) {
  const [result, setResult] = useState<CareStatus | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const updateCare = useUpdateCareRecord();

  useEffect(() => {
    if (!open || !record) return;
    setResult(
      record.status === CARE_STATUS.Succeeded || record.status === CARE_STATUS.Failed
        ? record.status
        : null,
    );
    setNote(record.description ?? "");
    setTouched(false);
  }, [open, record]);

  const toggleResult = (value: CareStatus) => {
    setResult((current) => (current === value ? null : value));
  };

  const handleSave = async () => {
    if (!record) return;
    if (!result) {
      setTouched(true);
      toast.error(t("Vui lòng chọn trạng thái chăm sóc"));
      return;
    }
    try {
      await updateCare.mutateAsync({
        id: record.id,
        subject: record.subject,
        description: note || undefined,
        assignedStaffId: record.assignedStaffId ?? undefined,
        careStaffId: record.careStaffId ?? undefined,
        dueAt: record.dueAt ?? undefined,
        scheduledStart: record.scheduledStart ?? undefined,
        scheduledEnd: record.scheduledEnd ?? undefined,
        status: result,
        stageIds: record.stageIds,
      });
      toast.success(t("Đã lưu kết quả chăm sóc"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <AppDialog
      open={open}
      title={tab.label()}
      canSave
      saving={updateCare.isPending}
      onSave={handleSave}
      onClose={onClose}
    >
      {record && (
        <div className="bd-form-grid">
          <CarePatientLine code={record.patientCode ?? ""} name={record.patientName ?? ""} tinted />

          <div
            className={["cskh-result-choices", touched && !result && "cskh-result-choices--error"]
              .filter(Boolean)
              .join(" ")}
          >
            {RESULT_CHOICES.map((choice) => (
              <button
                key={choice.value}
                type="button"
                role="checkbox"
                aria-checked={result === choice.value}
                className={["cskh-check-btn", result === choice.value && "cskh-check-btn--checked"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => toggleResult(choice.value)}
              >
                <span className="cskh-check-box" aria-hidden />
                {choice.label()}
              </button>
            ))}
          </div>

          <MessageField label={t("Ghi chú lần chăm sóc")} hasValue={Boolean(note)}>
            <Input.TextArea
              rows={5}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </MessageField>
        </div>
      )}
    </AppDialog>
  );
}
