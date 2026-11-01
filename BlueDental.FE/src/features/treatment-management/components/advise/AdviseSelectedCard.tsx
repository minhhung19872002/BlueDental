import { useState } from "react";
import { Input } from "antd";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";

interface Props {
  kind: "single" | "combo";
  name: string;
  /** "1 × 500.000 đ" for a service, the parts for a combo. */
  detail: string;
  amount: number;
  /** A service's note; a combo carries none. */
  note?: string;
  onNoteChange?: (note: string) => void;
  onRemove: () => void;
}

/**
 * One card of "Dịch vụ đã chọn" (P0111_02, R-1114): LẺ or COMBO, the name
 * and its ×, what it is made of, Thành tiền, and — for a service — "+ Ghi
 * chú", which opens the note the table's old Ghi chú column held.
 */
export function AdviseSelectedCard({
  kind,
  name,
  detail,
  amount,
  note,
  onNoteChange,
  onRemove,
}: Props) {
  const [noting, setNoting] = useState(Boolean(note));
  const combo = kind === "combo";

  return (
    <li className="am-pick">
      <div className="am-pick-head">
        <span className={combo ? "am-summary-kind am-summary-kind--combo" : "am-summary-kind"}>
          {combo ? t("Treatment:Combo:KindCombo") : t("Treatment:Combo:KindSingle")}
        </span>
        <span className="am-pick-name">{name}</span>
        <button
          type="button"
          className="am-summary-remove"
          aria-label={t("Treatment:Combo:RemoveItem", name)}
          onClick={onRemove}
        >
          <X size={14} />
        </button>
      </div>
      <div className="am-pick-foot">
        <span className="am-pick-detail">{detail}</span>
        {onNoteChange && !noting && (
          <button type="button" className="am-pick-note-btn" onClick={() => setNoting(true)}>
            <Plus size={12} />
            {t("Treatment:Common:Note")}
          </button>
        )}
        <b className="am-pick-amount">{moneyText(amount)}</b>
      </div>
      {onNoteChange && noting && (
        <Input
          className="am-pick-note"
          autoFocus={!note}
          aria-label={t("Treatment:Advise:NoteFor", name)}
          placeholder={t("Treatment:Common:Note")}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      )}
    </li>
  );
}
