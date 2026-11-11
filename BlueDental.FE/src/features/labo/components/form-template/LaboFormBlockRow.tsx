import { Button, Input, Select, Switch, Tag, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { isLockedBlock } from "../../api/laboFormTemplateApi";
import { BLOCK_NAME, isSystemKind } from "../request-slip/slipLayout";
import { LaboFormSectionFields } from "./LaboFormSectionFields";
import { isSection, type BlockDraft } from "./formTemplateModel";

interface Props {
  block: BlockDraft;
  index: number;
  count: number;
  /** The template-wide number of the section's first field, and whether the template still takes one more. */
  fieldSlot: { firstNumber: number; canAdd: boolean };
  onChange: (block: BlockDraft) => void;
  onMove: (step: -1 | 1) => void;
  onRemove: () => void;
}

const SPANS = [1, 2, 3] as const;

/**
 * One block of the layout being built (F-94). A system block of the slip can
 * be renamed (blank keeps its own name), resized, moved and — except Thông tin
 * phiếu and Chỉ định — hidden; a section of the template's own also holds its
 * fields and can be removed.
 */
export function LaboFormBlockRow({ block, index, count, fieldSlot, onChange, onMove, onRemove }: Props) {
  const section = isSection(block);
  const locked = isLockedBlock(block.kind);
  const ownName = isSystemKind(block.kind) ? t(BLOCK_NAME[block.kind]) : "";
  const name = ownName || String(index + 1);
  const className = ["ft-block", section && "ft-block--section", !block.visible && "ft-block--hidden"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} data-testid="form-block-row">
      <div className="ft-block-head">
        <Tag className="ft-block-kind" color={section ? "purple" : "blue"}>
          {t(section ? "Labo:FormTpl:CustomBlock" : "Labo:FormTpl:SystemBlock")}
        </Tag>
        <Input
          className="ft-block-title"
          value={block.title}
          maxLength={200}
          placeholder={section ? t("Labo:FormTpl:SectionTitle") : ownName}
          aria-label={t("Labo:FormTpl:BlockTitleOf", name)}
          status={section && !block.title.trim() ? "warning" : undefined}
          onChange={(event) => onChange({ ...block, title: event.target.value })}
        />
        <Select
          className="ft-block-span"
          value={block.span}
          aria-label={t("Labo:FormTpl:BlockSpanOf", name)}
          options={SPANS.map((span) => ({ value: span, label: t(`Labo:FormTpl:Span:${span}`) }))}
          onChange={(span) => onChange({ ...block, span })}
        />
        {locked ? (
          <span className="ft-block-always">{t("Labo:FormTpl:AlwaysShown")}</span>
        ) : (
          <Switch
            size="small"
            checked={block.visible}
            aria-label={t("Labo:FormTpl:BlockVisibleOf", name)}
            onChange={(visible) => onChange({ ...block, visible })}
          />
        )}
        <div className="ft-row-actions">
          <Tooltip title={t("Labo:FormTpl:MoveUp")}>
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={index === 0}
              aria-label={t("Labo:FormTpl:BlockUpOf", name)}
              onClick={() => onMove(-1)}
            />
          </Tooltip>
          <Tooltip title={t("Labo:FormTpl:MoveDown")}>
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={index === count - 1}
              aria-label={t("Labo:FormTpl:BlockDownOf", name)}
              onClick={() => onMove(1)}
            />
          </Tooltip>
          {section && (
            <Tooltip title={t("Common:Delete")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Labo:FormTpl:BlockRemoveOf", name)}
                onClick={onRemove}
              />
            </Tooltip>
          )}
        </div>
      </div>
      {section && (
        <LaboFormSectionFields
          fields={block.fields}
          firstNumber={fieldSlot.firstNumber}
          canAdd={fieldSlot.canAdd}
          onChange={(fields) => onChange({ ...block, fields })}
        />
      )}
    </div>
  );
}
