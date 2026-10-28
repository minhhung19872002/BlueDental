import type { KeyboardEvent } from "react";
import { t } from "@/lib/i18n";
import { hhmm, type SessionTrack } from "../utils/followUpSlots";
import { scaleMarks } from "../utils/trackScale";
import { useTrackDrag, type TrackHover } from "../hooks/useTrackDrag";
import { useTrackView } from "../hooks/useTrackView";
import { FollowUpTrackParts } from "./FollowUpTrackParts";
import { FollowUpTrackScale } from "./FollowUpTrackScale";
import type { MinuteSpan } from "../types/reception";

interface FollowUpTrackProps {
  label: string;
  track: SessionTrack | null;
  /** Across the bar while there is no track yet: no day, no doctor, loading. */
  emptyText: string;
  selected?: MinuteSpan;
  onRange: (range: MinuteSpan) => void;
}

/** The cursor for what a press would take hold of. */
const GRIP_CLASS: Record<TrackHover, string | false> = {
  create: false,
  blocked: "fu-track--blocked",
  move: "fu-track--grab",
  start: "fu-track--resize",
  end: "fu-track--resize",
};

function closedText(track: SessionTrack | null, emptyText: string): string {
  if (!track) return emptyText;
  return t(track.working ? "Reception:FollowUpSessionPast" : "Reception:FollowUpSessionOff");
}

function rangeText(track: SessionTrack | null): string {
  if (!track) return "—";
  return track.working ? `${hhmm(track.span.start)} – ${hhmm(track.span.end)}` : t("Reception:FollowUpNotWorking");
}

/**
 * One session of the picked day as a bar over the doctor's shift. The wheel
 * zooms it; a press on free bar starts a range, on the picked range moves
 * it, on its edges stretches it — never over a booked visit.
 */
export function FollowUpTrack({ label, track, emptyText, selected, onRange }: FollowUpTrackProps) {
  const span = track?.span;
  const sel = span && selected && selected.start >= span.start && selected.end <= span.end ? selected : undefined;
  const scale = useTrackView(span, sel);
  const { view } = scale;
  const drag = useTrackDrag(track, view, sel, onRange);
  const hasOpen = !!track && track.open.length > 0;
  const marks = view && scale.width > 0 ? scaleMarks(view, scale.width) : { ticks: [], lines: [] };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!scale.handleZoomKey(e)) drag.handleKeyDown(e);
  };

  const className = [
    "fu-track",
    !hasOpen && "fu-track--closed",
    hasOpen && GRIP_CLASS[drag.grip],
    hasOpen && drag.held && drag.grip === "move" && "fu-track--grabbing",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="fu-session">
      <div className="fu-session-head">
        <span className="fu-session-label">{label}</span>
        <span className="fu-session-range">{rangeText(track)}</span>
        {scale.zoomed && (
          <button type="button" className="fu-zoom-reset" onClick={scale.reset}>
            {t("Reception:FollowUpZoomReset")}
          </button>
        )}
      </div>
      <div className="fu-session-body">
        <div
          ref={scale.ref}
          className={className}
          {...(hasOpen && {
            role: "button",
            tabIndex: 0,
            "aria-label": t("Reception:FollowUpTrack", label),
            onKeyDown: handleKeyDown,
            ...drag.handlers,
          })}
        >
          {track && view && <FollowUpTrackParts track={track} view={view} lines={marks.lines} selected={sel} />}
          {!hasOpen && <span className="fu-track-note">{closedText(track, emptyText)}</span>}
        </div>
        {span && view ? (
          <FollowUpTrackScale span={span} view={view} ticks={marks.ticks} width={scale.width} zoomed={scale.zoomed} onCenter={scale.centerOn} />
        ) : (
          <div className="fu-ticks" aria-hidden />
        )}
      </div>
    </div>
  );
}
