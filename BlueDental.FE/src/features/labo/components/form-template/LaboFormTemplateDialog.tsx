import { Button, Input, Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { useLaboFormTemplateCommands, type LaboFormTemplateDto } from "../../api/laboFormTemplateApi";
import { LaboFormBlockRow } from "./LaboFormBlockRow";
import {
  MAX_FIELDS,
  MAX_SECTIONS,
  allFields,
  draftProblem,
  isSection,
  templateInput,
} from "./formTemplateModel";
import { useTemplateDraft } from "./useTemplateDraft";

interface Props {
  open: boolean;
  template: LaboFormTemplateDto | null;
  onClose: () => void;
}

/**
 * Tạo / Sửa mẫu phiếu (F-93, F-94): Tên mẫu, Mô tả, Trạng thái and the
 * layout of the Phiếu yêu cầu — its own blocks and the template's sections
 * with their fields. What still stops Lưu reads in the footer; the server
 * checks the same rules again. A slip that already took the template keeps its
 * own copy, so an edit only reaches the slips that pick it from now on.
 */
export function LaboFormTemplateDialog({ open, template, onClose }: Props) {
  const { draft, patch, updateBlock, moveBlock, removeBlock, addSection } = useTemplateDraft(open, template);
  const { create, update } = useLaboFormTemplateCommands();

  const problem = draftProblem(draft);
  const pending = create.isPending || update.isPending;
  const fieldCount = allFields(draft).length;
  const sectionCount = draft.blocks.filter(isSection).length;
  // The number of each block's first field, counting the fields of the blocks before it.
  const firstNumbers = draft.blocks.reduce<number[]>(
    (acc, _block, index) => [...acc, index === 0 ? 1 : acc[index - 1] + draft.blocks[index - 1].fields.length],
    [],
  );

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
      width={900}
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
          <span>{t("Labo:FormTpl:Layout")}</span>
          <span className="ft-count">
            {t("Labo:FormTpl:BlockCount", String(sectionCount), String(MAX_SECTIONS))}
            {" · "}
            {t("Labo:FormTpl:FieldCount", String(fieldCount), String(MAX_FIELDS))}
          </span>
        </div>
        <p className="ft-hint">{t("Labo:FormTpl:LayoutHint")}</p>
        {template && <p className="ft-hint">{t("Labo:FormTpl:SnapshotHint")}</p>}
        <div className="ft-fields">
          {draft.blocks.map((block, index) => (
            <LaboFormBlockRow
              key={block.rowId}
              block={block}
              index={index}
              count={draft.blocks.length}
              fieldSlot={{ firstNumber: firstNumbers[index], canAdd: fieldCount < MAX_FIELDS }}
              onChange={updateBlock}
              onMove={(step) => moveBlock(index, step)}
              onRemove={() => removeBlock(block.rowId)}
            />
          ))}
        </div>
        <Button icon={<PlusOutlined />} disabled={sectionCount >= MAX_SECTIONS} onClick={addSection}>
          {t("Labo:FormTpl:AddSection")}
        </Button>
      </div>
    </AppDialog>
  );
}
