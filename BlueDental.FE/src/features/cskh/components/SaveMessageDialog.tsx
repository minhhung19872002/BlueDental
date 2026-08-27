import { useEffect, useState } from "react";
import { Input } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { AppDialog } from "@/components/AppDialog";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect/SearchSelect";
import { useDebounce } from "@/hooks/useDebounce";
import { useSmsConfigures, useSmsTemplates } from "../api/messageApi";
import { CarePatientLine } from "./CarePatientLine";
import { MessageField } from "./MessageField";

interface SaveMessageDialogProps {
  open: boolean;
  patient: { code: string; name: string } | null;
  onClose: () => void;
}

/** The always-present first option of Mẫu tin nhắn — not a stored template. */
const FREE_TEMPLATE = "free";

/**
 * "Lưu tin nhắn" (message-square-text button). Cấu hình lists the branch's
 * enabled SMS channels (GET /clinic-configure?module=sms&isEnabled=true) and
 * Mẫu tin nhắn the branch's templates (GET /sender-sms-templates) behind the
 * "Tin nhắn tự do" default; picking a template reveals the message textarea.
 * TODO(send): the reference's submit request is UNKNOWN_REFERENCE_BEHAVIOR —
 * implement the real send once a sending configuration exists.
 */
export function SaveMessageDialog({ open, patient, onClose }: SaveMessageDialogProps) {
  const [configId, setConfigId] = useState<string | undefined>();
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [configSearch, setConfigSearch] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");

  const debouncedConfigSearch = useDebounce(configSearch);
  const debouncedTemplateSearch = useDebounce(templateSearch);
  const { data: configures } = useSmsConfigures(debouncedConfigSearch, open);
  const { data: templates } = useSmsTemplates(debouncedTemplateSearch, open);

  useEffect(() => {
    if (!open) return;
    setConfigId(undefined);
    setTemplateId(undefined);
    setContent("");
    setNote("");
    setConfigSearch("");
    setTemplateSearch("");
  }, [open]);

  const configOptions: SearchSelectOption[] = (configures?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const templateOptions: SearchSelectOption[] = [
    { value: FREE_TEMPLATE, label: t("Tin nhắn tự do") },
    ...(templates?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
  ];

  /* SearchSelect drops its keyword on close without firing onSearch, so clear
     the fetch filter on pick or the chosen option can vanish from the list. */
  const handleConfigChange = (value: string | undefined) => {
    setConfigId(value);
    setConfigSearch("");
  };

  /** A stored template pre-fills the message; Tin nhắn tự do starts blank. */
  const handleTemplateChange = (value: string | undefined) => {
    setTemplateId(value);
    setTemplateSearch("");
    setContent(templates?.items.find((item) => item.id === value)?.content ?? "");
  };

  const handleSend = () => {
    if (!configId) {
      toast.error(t("Vui lòng chọn cấu hình"));
      return;
    }
    if (!templateId) {
      toast.error(t("Vui lòng chọn mẫu tin nhắn"));
      return;
    }
    toast.error(t("Chức năng gửi tin nhắn chưa được hỗ trợ"));
  };

  return (
    <AppDialog
      open={open}
      title={t("Lưu tin nhắn")}
      canSave
      saving={false}
      saveLabel={t("Gửi")}
      onSave={handleSend}
      onClose={onClose}
    >
      <div className="bd-form-grid">
        {patient && <CarePatientLine code={patient.code} name={patient.name} tinted />}

        <div className="cskh-message-row">
          <MessageField label={t("Cấu hình")} required hasValue={Boolean(configId)}>
            <SearchSelect
              value={configId}
              options={configOptions}
              emptyText={t("Không tìm thấy dữ liệu")}
              allowClear
              onChange={handleConfigChange}
              onSearch={setConfigSearch}
            />
          </MessageField>
          <MessageField label={t("Mẫu tin nhắn")} required hasValue={Boolean(templateId)}>
            <SearchSelect
              value={templateId}
              options={templateOptions}
              emptyText={t("Không tìm thấy dữ liệu")}
              allowClear
              onChange={handleTemplateChange}
              onSearch={setTemplateSearch}
            />
          </MessageField>
        </div>

        {templateId && (
          <MessageField label={t("Nội dung tin nhắn gửi đi")} hasValue={Boolean(content)}>
            <Input.TextArea
              rows={4}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </MessageField>
        )}

        <MessageField label={t("Ghi chú CSKH")} hasValue={Boolean(note)}>
          <Input.TextArea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </MessageField>
      </div>
    </AppDialog>
  );
}
