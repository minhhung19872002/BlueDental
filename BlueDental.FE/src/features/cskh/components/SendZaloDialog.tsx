import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { AppDialog } from "@/components/AppDialog";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect/SearchSelect";
import { useDebounce } from "@/hooks/useDebounce";
import { useSendZaloMessage, useZaloTemplates } from "../api/messageApi";
import type { CareRecordDto } from "../api/careApi";
import { CarePatientLine } from "./CarePatientLine";
import { MessageField } from "./MessageField";

interface SendZaloDialogProps {
  open: boolean;
  record: CareRecordDto | null;
  onClose: () => void;
}

/**
 * "Gửi ZBS qua Zalo" (every care tab). Mẫu ZBS lists the branch's
 * approved ZNS templates straight from Zalo; Gửi posts the care record and the
 * template, and the server fills the template's parameters from the patient
 * and the record before asking Zalo to deliver it.
 */
export function SendZaloDialog({ open, record, onClose }: SendZaloDialogProps) {
  const [templateId, setTemplateId] = useState<string | undefined>();
  const [templateSearch, setTemplateSearch] = useState("");
  const [touched, setTouched] = useState(false);

  const debouncedSearch = useDebounce(templateSearch);
  const { data: templates, error: templatesError } = useZaloTemplates(debouncedSearch, open);
  const send = useSendZaloMessage();

  useEffect(() => {
    if (!open) return;
    setTemplateId(undefined);
    setTemplateSearch("");
    setTouched(false);
  }, [open]);

  const templateOptions: SearchSelectOption[] = (templates ?? []).map((item) => ({
    value: item.templateId,
    label: item.name,
  }));

  /* SearchSelect drops its keyword on close without firing onSearch, so clear
     the fetch filter on pick or the chosen option can vanish from the list. */
  const handleTemplateChange = (value: string | undefined) => {
    setTemplateId(value);
    setTemplateSearch("");
  };

  const handleSave = async () => {
    setTouched(true);
    if (!templateId || !record) {
      toast.error(t("CSKH:SendZalo:TemplateRequired"));
      return;
    }
    try {
      await send.mutateAsync({ careRecordId: record.id, templateId });
      toast.success(t("CSKH:SendZalo:Sent"));
      onClose();
    } catch {
      // MutationCache reports the failure globally; the attempt is listed
      // under Danh sách tin Zalo with Zalo's error message.
    }
  };

  return (
    <AppDialog
      open={open}
      title={t("CSKH:SendZalo:Title")}
      canSave={!send.isPending}
      saving={send.isPending}
      saveLabel={t("Common:Send")}
      savingLabel={t("CSKH:SendZalo:Sending")}
      onSave={() => void handleSave()}
      onClose={onClose}
    >
      {record && (
        <div className="bd-form-grid">
          <CarePatientLine label={t("CSKH:SendZalo:CustomerLabel")} name={record.patientName ?? ""} tinted />

          <MessageField label={t("CSKH:SendZalo:TemplateLabel")} required hasValue={Boolean(templateId)}>
            <SearchSelect
              value={templateId}
              options={templateOptions}
              emptyText={templatesError ? extractApiError(templatesError) : t("Common:NoResults")}
              allowClear
              status={touched && !templateId ? "error" : undefined}
              onChange={handleTemplateChange}
              onSearch={setTemplateSearch}
            />
          </MessageField>

          <p className="cskh-dialog-hint">
            {t("CSKH:SendZalo:HintAutoFill")}
          </p>
        </div>
      )}
    </AppDialog>
  );
}
