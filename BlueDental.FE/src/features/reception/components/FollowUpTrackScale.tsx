import { useRef, type PointerEvent } from "react";
import { t } from "@/lib/i18n";
import { hhmm } from "../utils/followUpSlots";
import { placed, spanLength } from "../utils/trackScale";
import type { MinuteSpan } from "../types/reception";

interface FollowUpTrackScaleProps {
  span: MinuteSpan;
  view: MinuteSpan;
  ticks: number[];
  /** The bar's width in pixels. */
  width: number;
  zoomed: boolean;
  onCenter: (minute: number) => void;
}

/** A label this close to an end of the bar is aligned to it rather than centred. */
const EDGE_LABEL_PX = 16;

/**
 * Under a session's bar: the hour labels of the part in view and, once
 * zoomed, a strip of the whole shift with the part in view on it — pressing
 * or dragging along the strip moves the view there.
 */
export function FollowUpTrackScale({ span, view, ticks, width, zoomed, onCenter }: FollowUpTrackScaleProps) {
  const dragging = useRef(false);
  const perMinute = width / spanLength(view);

  const tickClass = (m: number) => {
    const x = (m - view.start) * perMinute;
    return ["fu-at fu-tick", x < EDGE_LABEL_PX && "fu-tick--first", width - x < EDGE_LABEL_PX && "fu-tick--last"]
      .filter(Boolean)
      .join(" ");
  };

  const centerAt = (e: PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onCenter(span.start + ratio * spanLength(span));
  };

  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    centerAt(e);
  };

  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    if (dragging.current) centerAt(e);
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  return (
    <>
      <div className="fu-ticks" aria-hidden>
        {width > 0 &&
          ticks.map((m) => (
            <span key={m} className={tickClass(m)} style={placed(view, { start: m, end: m })}>
              {hhmm(m)}
            </span>
          ))}
      </div>
      {zoomed && (
        <div
          className="fu-overview"
          title={t("Reception:FollowUpOverview")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="fu-at fu-overview-thumb" style={placed(span, view)} />
        </div>
      )}
    </>
  );
}
