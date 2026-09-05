import { ArrowRightOutlined } from "@ant-design/icons";
import { Hash } from "lucide-react";
import { t } from "@/lib/i18n";
import type { HistoryEntry, HistoryFieldChange } from "../../types/appointmentHistory";
import { fieldLabel, formatFieldValue } from "./historyLabels";

/** One field on one line: its name, the red "before" box, an arrow, the green "after" box. */
function DiffRow({ change }: { change: HistoryFieldChange }) {
  return (
    <div className="ah-diff-row">
      <div className="ah-diff-field">
        <Hash size={12} strokeWidth={2} />
        <span>{fieldLabel(change.field)}</span>
      </div>
      <div className="ah-diff-box ah-diff-box--before">
        <span className="ah-diff-tag">{t("TRƯỚC")}</span>
        <span className="ah-diff-value">{formatFieldValue(change.field, change.before)}</span>
      </div>
      <ArrowRightOutlined className="ah-diff-arrow" />
      <div className="ah-diff-box ah-diff-box--after">
        <span className="ah-diff-tag">{t("SAU")}</span>
        <span className="ah-diff-value">{formatFieldValue(change.field, change.after)}</span>
      </div>
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "So sánh trước / sau" and the chips of every field the change touched. */
export function HistoryDiffCard({ entry }: { entry: HistoryEntry }) {
  const affected = entry.changedFields.length ? entry.changedFields : entry.diff.map((d) => d.field);

  return (
    <>
      <section className="ah-card ah-card--diff">
        <h4 className="ah-card-title">{t("So sánh trước / sau")}</h4>
        {entry.diff.length === 0 ? (
          <div className="ah-card-empty">{t("Không có thay đổi giá trị")}</div>
        ) : (
          <div className="ah-diff-rows">
            {entry.diff.map((change) => (
              <DiffRow key={change.field} change={change} />
            ))}
          </div>
        )}
      </section>

      <section className="ah-card ah-card--fields">
        <h4 className="ah-card-title">{t("Các trường bị ảnh hưởng")}</h4>
        {affected.length === 0 ? (
          <div className="ah-card-empty">—</div>
        ) : (
          <div className="ah-chips">
            {affected.map((field) => (
              <span key={field} className="ah-chip">
                {capitalize(field)}
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
