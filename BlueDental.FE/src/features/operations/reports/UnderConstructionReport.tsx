import { OperationsPeriodBar } from "./OperationsPeriodBar";
import { usePeriodRange } from "./usePeriodRange";
import { t } from "@/lib/i18n";

/**
 * A sub-tab the reference itself has not built.
 *
 * Đơn thuốc shows the period switch over a dashed panel reading
 * "Nội dung đang được xây dựng." — so this says exactly that, rather than
 * inventing a report the reference does not have.
 */
export function UnderConstructionReport() {
  const range = usePeriodRange("day");

  return (
    <div className="bd-ops-report-screen">
      <div className="bd-ops-report-bar">
        <OperationsPeriodBar range={range} />
      </div>

      <div className="bd-ops-construction">{t("Nội dung đang được xây dựng.")}</div>
    </div>
  );
}
