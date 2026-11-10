import { useEffect, useState } from "react";
import { Button, Input, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { useLaboFormTemplateCommands, type LaboFormTemplateDto } from "../../api/laboFormTemplateApi";
import { LaboFormFieldRow } from "./LaboFormFieldRow";
import {
  MAX_FIELDS,
  blankField,
  draftProblem,
  moveField,
  templateDraft,
  templateInput,
  type FieldDraft,
  type TemplateDraft,
} from "./formTemplateModel";

interface Props {
  open: boolean;
  template: LaboFormTemplateDto | null;
  onClose: () => void;
}

/**
 * Tạo / Sửa mẫu phiếu bổ sung (F-93): Tên mẫu, Mô tả, Trạng thái and the list
 * of fields. What still stops Lưu reads in the footer; the server checks the
 * same rules again. A slip that already took the template keeps its own copy,
 * so an edit only reaches the slips that pick it from now on.
 */
export function LaboFormTemplateDialog({ open, template, onClose }: Props) {
  const [draft, setDraft] = useState<TemplateDraft>(() => templateDraft(null));
  const { create, update } = useLaboFormTemplateCommands();

  useEffect(() => {
    if (open) setDraft(templateDraft(template));
  }, [open, template]);

  const problem = draftProblem(draft);
  const pending = create.isPending || update.isPending;
  const patch = (next: Partial<TemplateDraft>) => setDraft((current) => ({ ...current, ...next }));
  const setFields = (change: (fields: FieldDraft[]) => FieldDraft[]) =>
    setDraft((current) => ({ ...current, fields: change(current.fields) }));

  const handleSave = async () => {
    if (problem) return;
    const input = templateInput(draft);
    try {
      if (template) {
        await update.mutateAsync({ id: template.id, input });
        toast.success(t("Common:Updated"));
      } else {
        await create.mutateAsync(input);
        toast.success(t("Common:Added"));
      }
      onClose();
    } catch {
      // queryClient reports the failure (a taken name among them); the dialog stays open to retry.
    }
  };

  const noun = t("Labo:Noun:FormTemplate");
  return (
    <AppDialog
      open={open}
      width={760}
      title={template ? t("Common:EditItem", noun) : t("Common:CreateItem", noun)}
      canSave={problem === null}
      saving={pending}
      footerLeft={problem && <span className="ft-problem" role="status">{problem}</span>}
      onSave={() => void handleSave()}
      onClose={onClose}
    >
      <div className="ft-dialog">
        <div className="ft-head">
          <label className="ft-label">
            <span>{t("Labo:FormTpl:Name")} <em className="ft-req">*</em></span>
            <Input autoFocus maxLength={200} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="ft-label ft-label--status">
            <span>{t("Common:Status")}</span>
            <Select
              value={draft.isActive}
              aria-label={t("Common:Status")}
              options={[
                { value: true, label: t("Labo:Material:InUse") },
                { value: false, label: t("Labo:Material:Stopped") },
              ]}
              onChange={(isActive) => patch({ isActive })}
            />
          </label>
        </div>
        <label className="ft-label">
          <span>{t("Common:Description")}</span>
          <Input maxLength={500} value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
        </label>

        <div className="ft-fields-head">
          <span>{t("Labo:FormTpl:Fields")}</span>
          <span className="ft-count">{t("Labo:FormTpl:FieldCount", String(draft.fields.length), String(MAX_FIELDS))}</span>
        </div>
        {template && <p className="ft-hint">{t("Labo:FormTpl:SnapshotHint")}</p>}
        <div className="ft-fields">
          {draft.fields.map((field, index) => (
            <LaboFormFieldRow
              key={field.rowId}
              field={field}
              index={index}
              count={draft.fields.length}
              onChange={(next) => setFields((fields) => fields.map((f) => (f.rowId === field.rowId ? next : f)))}
              onMove={(step) => setFields((fields) => moveField(fields, index, step))}
              onRemove={() => setFields((fields) => fields.filter((f) => f.rowId !== field.rowId))}
            />
          ))}
        </div>
        <Button
          icon={<PlusOutlined />}
          disabled={draft.fields.length >= MAX_FIELDS}
          onClick={() => setFields((fields) => [...fields, blankField()])}
        >
          {t("Labo:FormTpl:AddField")}
        </Button>
      </div>
    </AppDialog>
  );
}
