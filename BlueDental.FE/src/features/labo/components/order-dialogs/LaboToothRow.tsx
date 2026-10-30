import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { TeethChartButton } from "./LaboTeethChartButton";

interface Props {
  /** The FDI numbers the order carries. */
  teeth: string[];
  quantity: string;
  /** The order's Số phiếu, for the chart's title. */
  code: string;
  /** What stands in for the button while the source names no tooth. */
  empty: ReactNode;
}

/**
 * "Răng *" on the Đặt hàng tab (P2910_03, BA DNBX-19/20): the order takes every
 * tooth of its công đoạn or line, so there is nothing to pick here — a jaw
 * button opens them on a chart that is only looked at, and "Số lượng: N"
 * follows it.
 */
export function LaboToothRow({ teeth, quantity, code, empty }: Props) {
  return (
    <div className="pd-labo-teeth">
      <p>
        {t("Patient:DentalChart:Tooth")}
        <span className="floating-field-required">*</span>
      </p>
      {teeth.length === 0 ? (
        empty
      ) : (
        <>
          <TeethChartButton teeth={teeth.map(Number)} code={code} />
          <span className="pd-labo-teeth-count">
            {t("Patient:Payment:Quantity")}: <b>{quantity}</b>
          </span>
        </>
      )}
    </div>
  );
}
