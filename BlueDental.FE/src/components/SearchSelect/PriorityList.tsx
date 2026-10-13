import React from "react";
import { CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { SearchSelectOption } from "./SearchSelect";

interface PriorityListProps {
  /** The picked options, highest priority first. */
  items: SearchSelectOption[];
  /** Where the order comes from, shown beside the heading. */
  hint?: string;
  onRemove: (value: string) => void;
}

/** The picked options as a numbered list on top of the dropdown; ✕ drops one. */
export const PriorityList: React.FC<PriorityListProps> = ({ items, hint, onRemove }) => (
  <div className="ms-priority">
    <div className="ms-priority-head">
      <span>{t("Common:PriorityOrder")}</span>
      {hint && items.length > 1 && <span className="ms-priority-hint">{hint}</span>}
    </div>
    <ol className="ms-priority-list" aria-label={t("Common:PriorityOrder")}>
      {items.map((option, index) => (
        <li key={option.value} className="ms-priority-row">
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
