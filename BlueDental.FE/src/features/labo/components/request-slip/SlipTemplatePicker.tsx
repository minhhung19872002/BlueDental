import { Select } from "antd";
import { t } from "@/lib/i18n";
import { foldFilterOption } from "@/utils/foldForSearch";
import type { LaboExtraFormDto, LaboFormTemplateDto } from "@/features/labo/api/laboFormTemplateApi";
import { pickExtra, type ExtraFormValues } from "./extraFormModel";

interface Props {
  /** The branch's Đang dùng templates; empty while the slip is locked. */
  templates: LaboFormTemplateDto[];
  extra: ExtraFormValues | null;
  /** What the order holds on the server, so picking its template again restores the copy. */
  saved: LaboExtraFormDto | null | undefined;
  editable: boolean;
  onChange: (extra: ExtraFormValues | null) => void;
}

/** The picker's choices: the live templates, and the one the slip holds even if it was switched off since. */
function templateOptions(templates: LaboFormTemplateDto[], extra: ExtraFormValues | null, saved: Props["saved"]) {
  const options = templates.map((template) => ({ value: template.id, label: template.name }));
  for (const held of [extra, saved]) {
    if (held && !options.some((option) => option.value === held.templateId))
      options.push({ value: held.templateId, label: held.templateName });
  }
  return options;
}

/**
 * Mẫu phiếu (F-93, F-94): the template that lays this slip out, picked at the
 * top of the sheet. Shown only while the branch keeps an Đang dùng template,
 * or the slip already holds one — otherwise the slip reads as it did before.
 */
export function SlipTemplatePicker({ templates, extra, saved, editable, onChange }: Props) {
  // Cleared on an open slip, the picker stays while there is something to pick: a live template or the saved copy.
  if (!extra && !(editable && (templates.length > 0 || saved))) return null;

  return (
    <label className="rs-extra-pick rs-tpl-bar">
      <span className="rs-extra-label">{t("Labo:Slip:ExtraTemplate")}</span>
      <Select
        allowClear
        showSearch={{ filterOption: foldFilterOption }}
        value={extra?.templateId}
        disabled={!editable}
        aria-label={t("Labo:Slip:ExtraTemplate")}
        placeholder={t("Labo:Slip:ExtraNone")}
        options={templateOptions(templates, extra, saved)}
        onChange={(id: string | undefined) => onChange(pickExtra(id, templates, saved))}
      />
    </label>
  );
}
