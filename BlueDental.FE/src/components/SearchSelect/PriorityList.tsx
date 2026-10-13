import React from "react";
import { CloseOutlined, HolderOutlined } from "@ant-design/icons";
import { useDragReorder } from "@/hooks/useDragReorder";
import { t } from "@/lib/i18n";
import { moveItem } from "@/utils/array";
import type { SearchSelectOption } from "./SearchSelect";

interface PriorityListProps {
  /** The picked options, highest priority first. */
  items: SearchSelectOption[];
  onReorder: (next: SearchSelectOption[]) => void;
  onRemove: (value: string) => void;
}

/**
 * The picked options as a numbered list on top of the dropdown: drag the grip
 * (or ↑/↓ on it) to change the priority, ✕ to drop one.
 */
export const PriorityList: React.FC<PriorityListProps> = ({ items, onReorder, onRemove }) => {
  const drag = useDragReorder({
    items,
    getKey: (option) => option.value,
    enabled: items.length > 1,
    onCommit: (from, to) => onReorder(moveItem(items, from, to)),
  });

  const handleGripKeyDown = (index: number) => (event: React.KeyboardEvent) => {
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
    if (to < 0 || to >= items.length) return;
    event.preventDefault();
    onReorder(moveItem(items, index, to));
  };

  return (
    <div className="ms-priority">
      <div className="ms-priority-head">
        <span>{t("Common:PriorityOrder")}</span>
        {items.length > 1 && <span className="ms-priority-hint">{t("Common:DragToSort")}</span>}
      </div>
      <ol className="ms-priority-list" aria-label={t("Common:PriorityOrder")}>
        {drag.items.map((option, index) => (
          <li
            key={option.value}
            ref={drag.registerRow(option.value)}
            className={["ms-priority-row", drag.draggingKey === option.value && "ms-priority-row--dragging"]
              .filter(Boolean)
              .join(" ")}
          >
            {items.length > 1 && (
              <button
                type="button"
                className="bd-grip"
                title={t("Common:DragOrArrowSort")}
                aria-label={`${t("Common:DragToSort")}: ${option.label}`}
                {...drag.handleProps(option.value)}
                onKeyDown={handleGripKeyDown(index)}
              >
                <HolderOutlined aria-hidden="true" />
              </button>
            )}
            <span className="ms-priority-rank">{index + 1}</span>
            <span className="ms-priority-label" title={option.label}>{option.label}</span>
            <button
              type="button"
              className="ms-priority-remove"
              aria-label={`${t("Common:Clear")}: ${option.label}`}
              onClick={() => onRemove(option.value)}
            >
              <CloseOutlined aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
};
