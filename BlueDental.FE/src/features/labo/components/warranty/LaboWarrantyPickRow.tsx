import { RightOutlined } from "@ant-design/icons";
import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import { LaboWarrantyReadiness } from "./LaboWarrantyReadiness";
import { isWarrantyCardReady, type LaboWarrantyCardValues } from "./useLaboWarrantyForm";

export interface LaboWarrantyPick {
  on: boolean;
  /** Its card form as typed so far, read only when picked. */
  card: LaboWarrantyCardValues | undefined;
  /** Pressed last, ringed with its card form. */
  focused: boolean;
}

/** "Sứ Zirconia" · "Đạt 01/11/2026" — a long name wraps, the date stays whole. */
export interface LaboWarrantyPickCaption {
  restoration: string;
  passedOn: string | undefined;
}

interface Props {
  toothNumber: number;
  caption: LaboWarrantyPickCaption;
  pick: LaboWarrantyPick;
  disabled: boolean;
  onToggle: () => void;
  onJump: () => void;
}

/**
 * One tooth in 1. Chọn răng kích hoạt (BA mock): the tick, centred, picks it;
 * the rest of the card — number tile, Răng n over the caption, ›, and the
 * readiness pill on its own line under the tile — picks it if need be and
 * jumps to its card form. The tile is green once the form is complete.
 */
export function LaboWarrantyPickRow({ toothNumber, caption, pick, disabled, onToggle, onJump }: Props) {
  const label = t("Labo:Check:ToothLabel", toothNumber);
  const className = [
    "pd-labo-wpick",
    pick.on && "pd-labo-wpick--on",
    pick.on && isWarrantyCardReady(pick.card) && "pd-labo-wpick--ready",
    pick.focused && "pd-labo-wpick--focus",
  ]
    .filter(Boolean)
    .join(" ");
  const fullCaption = [caption.restoration, caption.passedOn].filter(Boolean).join(" · ");

  return (
    <li className={className}>
      <Checkbox className="pd-labo-wpick-check" checked={pick.on} disabled={disabled} aria-label={label} onChange={onToggle} />
      <button type="button" className="pd-labo-wpick-body" disabled={disabled} onClick={onJump}>
        <span className="pd-labo-wpick-no">{toothNumber}</span>
        <strong className="pd-labo-wpick-title">{label}</strong>
        <span className="pd-labo-wpick-caption" title={fullCaption}>
          {caption.restoration}
          {caption.restoration && caption.passedOn && <span aria-hidden> · </span>}
          {caption.passedOn && <span className="pd-labo-wpick-passed">{caption.passedOn}</span>}
        </span>
        <RightOutlined className="pd-labo-wpick-chevron" aria-hidden />
        {pick.on && (
          <span className="pd-labo-wpick-state">
            <LaboWarrantyReadiness card={pick.card} />
          </span>
        )}
      </button>
    </li>
  );
}
