import { ArrowRightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { StageChangeFieldDto } from "@/features/treatment-management/api/stageApi";

interface Props {
  changes: StageChangeFieldDto[];
}

/** The expanded row: one "field — before → after" line per changed field. */
export function StageChangeLogDiff({ changes }: Props) {
  if (changes.length === 0) return <p className="stage-log-diff__empty">{t("Patient:StageLog:NoDetail")}</p>;

  return (
    <div className="stage-log-diff">
      {changes.map((change) => (
        <div key={change.field} className="stage-log-diff__row">
          <span className="stage-log-diff__field">{t(`Patient:StageLog:Field:${change.field}`)}</span>
          <span className="stage-log-diff__box stage-log-diff__box--before">
            <span className="stage-log-diff__tag">{t("Patient:StageLog:Before")}</span>
            <span className="stage-log-diff__text">{change.before || "—"}</span>
          </span>
          <ArrowRightOutlined className="stage-log-diff__arrow" />
          <span className="stage-log-diff__box stage-log-diff__box--after">
            <span className="stage-log-diff__tag">{t("Patient:StageLog:After")}</span>
            <span className="stage-log-diff__text">{change.after || "—"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
