import { Button } from "antd";
import { SaveOutlined, UndoOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { BRUSH_SHIFTS, SHIFT_CODE, type BrushShift } from "../../utils/workScheduleShift";
import { shiftLabel } from "../../utils/workScheduleText";

interface Props {
  brush: BrushShift;
  onBrushChange: (brush: BrushShift) => void;
  pendingCount: number;
  onReset: () => void;
  onSave: () => void;
}

/** "Chọn loại ca" brushes, the pending legend, "Đặt lại" and "Lưu lịch". */
export function ShiftBrushBar({ brush, onBrushChange, pendingCount, onReset, onSave }: Props) {
  const idle = pendingCount === 0;
  return (
    <div className="ws-brushbar">
      <span className="ws-step">{t("Timekeeping:Board:PickShift")}</span>
      {BRUSH_SHIFTS.map((shift) => (
        <button
          key={shift}
          type="button"
          className={["ws-brush", brush === shift && "ws-brush--on"].filter(Boolean).join(" ")}
          aria-pressed={brush === shift}
          onClick={() => onBrushChange(shift)}
        >
          <span className={`ws-swatch ws-k-${SHIFT_CODE[shift].css}`}>{SHIFT_CODE[shift].short}</span>
          {shiftLabel(shift)}
        </button>
      ))}
      <span className="ws-brushbar-sep" aria-hidden="true" />
      <span className="ws-legend">
        <span className="ws-legend-box" aria-hidden="true" />
        {t("Timekeeping:Board:PendingLegend")}
      </span>
      <span className="ws-grow" />
      {idle ? null : (
        <span className="ws-badge ws-badge--pending ws-badge--lg">
          {t("Timekeeping:Board:PendingCount", pendingCount)}
        </span>
      )}
      <Button icon={<UndoOutlined />} disabled={idle} onClick={onReset}>
        {t("Timekeeping:Board:Reset")}
      </Button>
      <Button type="primary" icon={<SaveOutlined />} disabled={idle} onClick={onSave}>
        {t("Timekeeping:Board:Save")}
      </Button>
    </div>
  );
}
