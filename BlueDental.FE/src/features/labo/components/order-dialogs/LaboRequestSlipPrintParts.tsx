import { t } from "@/lib/i18n";
import type { LaboShadeZonesDto } from "@/features/labo/api/laboApi";
import { CHART_ROWS } from "../request-slip/requestSlipModel";
import { SHADE_ROWS } from "./laboRequestSlipText";

const cell = (value: string | null | undefined) => value?.trim() || "";

/** Màu răng on paper: Cổ / Thân / Rìa cắn down, Gần and Xa across, blanks left to write in. */
export function PrintShadeTable({ zones }: { zones: LaboShadeZonesDto | null | undefined }) {
  return (
    <table className="pd-slip-print-shade">
      <thead>
        <tr>
          <th aria-label={t("Labo:Slip:Shade")} />
          <th>{t("Labo:Slip:Mesial")}</th>
          <th>{t("Labo:Slip:Distal")}</th>
        </tr>
      </thead>
      <tbody>
        {SHADE_ROWS.map(([label, mesial, distal]) => (
          <tr key={label}>
            <th>{t(label)}</th>
            <td>{cell(zones?.[mesial])}</td>
            <td>{cell(zones?.[distal])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Chỉ định on paper: the slip's 4-quadrant row of numbers, the picked teeth boxed. */
export function PrintToothChart({ picked }: { picked: ReadonlySet<number> }) {
  return (
    <div className="pd-slip-print-chart">
      {CHART_ROWS.map(([right, left], row) => (
        <div key={row} className="pd-slip-print-chart-row">
          {[right, left].map((half, side) => (
            <div key={side} className="pd-slip-print-chart-half">
              {half.map((fdi) => (
                <span key={fdi} className={picked.has(fdi) ? "is-picked" : undefined}>
                  {fdi}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** "☑ Ca mới   ☐ Sửa / làm lại" — both boxes printed, the order's one ticked. */
export function PrintCaseBoxes({ redo }: { redo: boolean }) {
  return (
    <span className="pd-slip-print-case">
      <span>{`${redo ? "☐" : "☑"} ${t("Labo:Slip:CaseNew")}`}</span>
      <span>{`${redo ? "☑" : "☐"} ${t("Labo:Slip:CaseRedo")}`}</span>
    </span>
  );
}
