import { Tooltip } from "antd";
import { t } from "@/lib/i18n";

/**
 * The jaw button that opens a công đoạn's tooth chart — beside a form's tooth
 * chips, and under a history row's service in place of its tooth numbers.
 */
export function StageChartButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title={t("Patient:Stage:ViewChart")}>
      <button
        type="button"
        className="pd-stage-chartbtn"
        aria-label={t("Patient:Stage:ViewChart")}
        onClick={onClick}
      >
        <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
      </button>
    </Tooltip>
  );
}
