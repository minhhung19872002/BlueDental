import { useEffect, useState } from "react";
import { Popover } from "antd";
import { GripVertical, Settings2, X } from "lucide-react";
import { useDragReorder } from "@/hooks/useDragReorder";
import { t } from "@/lib/i18n";
import { moveItem } from "@/utils/array";
import { PLAN_COLUMN_LABELS, type PlanColumnSetting } from "./planTypes";

interface ListProps {
  value: PlanColumnSetting[];
  onSave: (next: PlanColumnSetting[]) => void;
  onClose: () => void;
}

/**
 * "Cấu hình cột": drag rows to reorder, flip the switch to hide, and nothing
 * reaches the table until "Lưu". The reference keeps this in memory only —
 * a reload restores the defaults — so there is no API or storage here either.
 */
function ColumnConfigList({ value, onSave, onClose }: ListProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const drag = useDragReorder({
    items: draft,
    getKey: (item) => item.key,
    enabled: true,
    onCommit: (from, to) => setDraft((current) => moveItem(current, from, to)),
  });

  const toggle = (key: PlanColumnSetting["key"]) =>
    setDraft((current) =>
      current.map((item) => (item.key === key ? { ...item, visible: !item.visible } : item)),
    );

  return (
    <div className="tp-columns">
      <div className="tp-columns-head">
        <span>{t("Cấu hình cột")}</span>
        <button type="button" className="tp-columns-close" aria-label={t("Đóng")} onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="tp-columns-list">
        {drag.items.map((item) => {
          const label = t(PLAN_COLUMN_LABELS[item.key]);
          return (
            <li
              key={item.key}
              ref={drag.registerRow(item.key)}
              className={[
                "tp-columns-row",
                drag.draggingKey === item.key && "tp-columns-row--dragging",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="tp-columns-grip"
                aria-label={t("Sắp xếp {0}", label)}
                {...drag.handleProps(item.key)}
              >
                <GripVertical size={16} aria-hidden="true" />
              </button>
              <span className="tp-columns-label">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={item.visible}
                aria-label={label}
                className="tp-switch"
                onClick={() => toggle(item.key)}
              />
            </li>
          );
        })}
      </ul>
      <div className="tp-columns-foot">
        <button type="button" className="tp-columns-save" onClick={() => onSave(draft)}>
          {t("Lưu")}
        </button>
      </div>
    </div>
  );
}

interface Props {
  value: PlanColumnSetting[];
  onChange: (next: PlanColumnSetting[]) => void;
}

export function PlanColumnConfigPopover({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const handleSave = (next: PlanColumnSetting[]) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div className="tp-column-action">
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomRight"
        arrow={false}
        classNames={{ root: "tp-columns-popover" }}
        content={<ColumnConfigList value={value} onSave={handleSave} onClose={() => setOpen(false)} />}
      >
        <button type="button" className="tp-column-btn" aria-expanded={open}>
          <Settings2 size={14} aria-hidden="true" />
          {t("Cột hiển thị")}
        </button>
      </Popover>
    </div>
  );
}
