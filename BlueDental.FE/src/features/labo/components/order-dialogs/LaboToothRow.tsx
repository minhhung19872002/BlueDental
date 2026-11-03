import { useState, type ReactNode } from "react";
import { Form, Tooltip } from "antd";
import { jawLabel, wholeJawOfTeeth } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { TeethChartButton } from "./LaboTeethChartButton";
import { LaboTeethPickDialog } from "./LaboTeethPickDialog";
import type { LaboPriorTeeth } from "./laboPriorTeeth";
import { toothLabel } from "./laboToothSpecs";
import { ToothOutlineIcon } from "./ToothOutlineIcon";
import "./labo-order-rows.css";

interface Props {
  id?: string;
  /** The FDI numbers the order carries. */
  value?: string[];
  /** "cầu 3 đơn vị" follows Số lượng when the teeth make a bridge. */
  bridge: boolean;
  /** The order's Số phiếu, for a sent order's view-only chart. */
  code: string;
  /** What a sent order with no tooth shows in place of the button. */
  empty: ReactNode;
  /** A sent order: the button only opens the chart to look at. */
  readOnly: boolean;
  /** Teeth already on another order of the slip: their chips turn orange (R-1106). */
  priors: LaboPriorTeeth;
  onChange?: (teeth: string[]) => void;
}

/**
 * "Răng *" on the Đặt hàng tab (P3110 m134, REQ-C6): the purple tooth button
 * opens the chart to pick teeth; R11 / R12 / R13 after it are only read — a
 * whole jaw as one chip, "Hàm trên" / "Hàm dưới" / "Hai hàm" (R-1098) — then
 * "Số lượng: n" and, for a bridge, "· cầu n đơn vị". A tooth already on
 * another order of the phiếu điều trị reads orange, "R11 •" (P0111_02,
 * R-1106). A form control, so a
 * Form.Item asks for at least one tooth and paints the label red.
 */
export function LaboToothRow({ id, value = [], bridge, code, empty, readOnly, priors, onChange }: Props) {
  const { status } = Form.Item.useStatus();
  const [open, setOpen] = useState(false);
  const jaw = wholeJawOfTeeth(value.map(Number));
  const className = ["pd-labo-teeth", status === "error" && "pd-labo-teeth--error"].filter(Boolean).join(" ");
  const chipClass = (prior: boolean) => (prior ? "pd-labo-toothchip pd-labo-toothchip--prior" : "pd-labo-toothchip");

  const handleConfirm = (teeth: number[]) => {
    setOpen(false);
    onChange?.(teeth.map(String));
  };

  return (
    <div id={id} className={className}>
      <p>
        {t("Patient:DentalChart:Tooth")}
        <span className="floating-field-required">*</span>
      </p>
      {readOnly ? (
        value.length === 0 ? empty : <TeethChartButton teeth={value.map(Number)} code={code} />
      ) : (
        <Tooltip title={t("Treatment:Tooth:ToothPicker")}>
          <button
            type="button"
            className="pd-labo-chartbtn pd-labo-chartbtn--pick"
            aria-label={t("Treatment:Tooth:ToothPicker")}
            onClick={() => setOpen(true)}
          >
            <ToothOutlineIcon />
          </button>
        </Tooltip>
      )}
      {jaw ? (
        <span className={chipClass(value.some((fdi) => priors.has(fdi)))}>{jawLabel(jaw)}</span>
      ) : (
        value.map((fdi) => (
          <span key={fdi} className={chipClass(priors.has(fdi))}>
            {toothLabel(fdi)}
          </span>
        ))
      )}
      {value.length > 0 && (
        <span className="pd-labo-teeth-count">
          {t("Patient:Payment:Quantity")}: <b>{value.length}</b>
          {bridge && ` · ${t("Labo:Teeth:Bridge", value.length)}`}
        </span>
      )}
      <LaboTeethPickDialog
        open={open}
        teeth={value.map(Number)}
        onConfirm={handleConfirm}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
