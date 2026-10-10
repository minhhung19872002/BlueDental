import { ArrowRightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { OrgUnitChange } from "../../api/orgChartApi";

interface Props {
  changes: OrgUnitChange[];
}

/** The expanded row: one "field — before → after" line per changed field. */
export function OrgHistoryDiff({ changes }: Props) {
  if (changes.length === 0) return <p className="org-muted org-history-diff__empty">{t("OrgChart:History:NoDetail")}</p>;

  return (
    <div className="org-history-diff">
      {changes.map((change) => (
        <div key={change.field} className="org-history-diff__row">
          <span className="org-history-diff__field">{t(`OrgChart:Field:${change.field}`)}</span>
          <span className="org-history-diff__box org-history-diff__box--before">
            <span className="org-history-diff__tag">{t("OrgChart:History:Before")}</span>
            {change.before || "—"}
          </span>
          <ArrowRightOutlined className="org-history-diff__arrow" />
          <span className="org-history-diff__box org-history-diff__box--after">
            <span className="org-history-diff__tag">{t("OrgChart:History:After")}</span>
            {change.after || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
