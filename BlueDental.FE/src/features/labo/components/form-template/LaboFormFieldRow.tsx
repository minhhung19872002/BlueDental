import { Button, Checkbox, Input, Select, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_FIELD_TYPES, isChoiceType } from "../../api/laboFormTemplateApi";
import { FIELD_TYPE_LABEL, MAX_OPTIONS, MAX_OPTION_LENGTH, type FieldDraft } from "./formTemplateModel";

interface Props {
  field: FieldDraft;
  index: number;
  count: number;
  onChange: (field: FieldDraft) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}

/**
 * One field of the template being built: Nhãn, Kiểu, Bắt buộc and — for the
 * choice kinds only — the Lựa chọn, typed and confirmed with Enter. The arrows
 * set the order the Phiếu yêu cầu shows them in.
 */
export function LaboFormFieldRow({ field, index, count, onChange, onMove, onRemove }: Props) {
  const position = String(index + 1);
  const choice = isChoiceType(field.type);

  const handleOptions = (options: string[]) =>
    onChange({ ...field, options: options.map((o) => o.slice(0, MAX_OPTION_LENGTH)).slice(0, MAX_OPTIONS) });

  return (
    <div className="ft-row" data-testid="form-field-row">
      <span className="ft-row-no">{position}</span>
      <div className="ft-row-main">
        <div className="ft-row-line">
          <Input
            className="ft-row-label"
            value={field.label}
            maxLength={200}
            placeholder={t("Labo:FormTpl:FieldLabel")}
            aria-label={t("Labo:FormTpl:FieldLabelOf", position)}
            status={field.label.trim() ? undefined : "warning"}
            onChange={(event) => onChange({ ...field, label: event.target.value })}
          />
          <Select
            className="ft-row-type"
            value={field.type}
            aria-label={t("Labo:FormTpl:FieldTypeOf", position)}
            options={LABO_FIELD_TYPES.map((type) => ({ value: type, label: t(FIELD_TYPE_LABEL[type]) }))}
            onChange={(type) => onChange({ ...field, type })}
          />
          <Checkbox checked={field.required} onChange={(event) => onChange({ ...field, required: event.target.checked })}>
            {t("Common:Required")}
          </Checkbox>
        </div>
        {choice && (
          <Select
            mode="tags"
            className="ft-row-options"
            value={field.options}
            open={false}
            suffixIcon={null}
            tokenSeparators={[";"]}
            placeholder={t("Labo:FormTpl:OptionsHint")}
            aria-label={t("Labo:FormTpl:OptionsOf", position)}
            status={field.options.some((o) => o.trim()) ? undefined : "warning"}
            onChange={handleOptions}
          />
        )}
      </div>
      <div className="ft-row-actions">
        <Tooltip title={t("Labo:FormTpl:MoveUp")}>
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            aria-label={t("Labo:FormTpl:MoveUpOf", position)}
            onClick={() => onMove(-1)}
          />
        </Tooltip>
        <Tooltip title={t("Labo:FormTpl:MoveDown")}>
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === count - 1}
            aria-label={t("Labo:FormTpl:MoveDownOf", position)}
            onClick={() => onMove(1)}
          />
        </Tooltip>
        <Tooltip title={t("Common:Delete")}>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={count === 1}
            aria-label={t("Labo:FormTpl:RemoveOf", position)}
            onClick={onRemove}
          />
        </Tooltip>
      </div>
    </div>
  );
}
