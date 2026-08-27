import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { AppDialog } from "@/components/AppDialog";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect/SearchSelect";
import { useDebounce } from "@/hooks/useDebounce";
import { useZaloTemplates } from "../api/messageApi";
import type { CareRecordDto } from "../api/careApi";
import { CarePatientLine } from "./CarePatientLine";
import { MessageField } from "./MessageField";

interface SendZaloDialogProps {
  open: boolean;
  record: CareRecordDto | null;
  onClose: () => void;
}

/**
 * "Gửi ZBS qua Zalo" (reminder + birthday tabs). Mẫu ZBS lists the Zalo-channel templates
 * that Công cụ ▸ Zalo OA ▸ Mẫu ZBS manages (GET /tools/message-templates,
 * channel 1), and Gửi without a template is blocked client-side the way the
 * reference blocks it; the real send endpoint is UNKNOWN_REFERENCE_BEHAVIOR,
 * so submitting stays UI-only.
 */
export function SendZaloDialog({ open, record, onClose }: SendZaloDialogProps) {
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [templateSearch, setTemplateSearch] = useState("");
  const [touched, setTouched] = useState(false);

  const debouncedSearch = useDebounce(templateSearch);
  const { data: templates } = useZaloTemplates(debouncedSearch, open);

  useEffect(() => {
    if (!open) return;
    setTemplateId(undefined);
    setTemplateSearch("");
    setTouched(false);
  }, [open]);

  const templateOptions: SearchSelectOption[] = (templates?.items ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }));

  /* SearchSelect drops its keyword on close without firing onSearch, so clear
     the fetch filter on pick or the chosen option can vanish from the list. */
  const handleTemplateChange = (value: string | undefined) => {
    setTemplateId(value);
    setTemplateSearch("");
  };

  const handleSave = () => {
    setTouched(true);
    if (!templateId) {
      toast.error(t("Vui lòng chọn mẫu ZBS"));
      return;
    }
    toast.error(t("Chức năng gửi ZBS chưa được hỗ trợ"));
  };

  return (
    <AppDialog
      open={open}
      title={t("Gửi ZBS qua Zalo")}
      canSave
      saving={false}
      saveLabel={t("Gửi")}
      onSave={handleSave}
      onClose={onClose}
    >
      {record && (
        <div className="bd-form-grid">
          <CarePatientLine label={t("Khách hàng")} name={record.patientName ?? ""} tinted />

          <MessageField label={t("Mẫu ZBS")} required hasValue={Boolean(templateId)}>
            <SearchSelect
              value={templateId}
              options={templateOptions}
              emptyText={t("Không tìm thấy dữ liệu")}
              allowClear
              status={touched && !templateId ? "error" : undefined}
              onChange={handleTemplateChange}
              onSearch={setTemplateSearch}
            />
          </MessageField>

          <p className="cskh-dialog-hint">
            {t(
              "Nội dung tin nhắn được điền tự động từ dữ liệu khách hàng — chỉ cần chọn mẫu.",
            )}
          </p>
        </div>
      )}
    </AppDialog>
  );
}
