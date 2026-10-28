import { t } from "@/lib/i18n";
import { hhmm, type SessionTrack } from "../utils/followUpSlots";
import { placed } from "../utils/trackScale";
import type { MinuteSpan } from "../types/reception";

interface FollowUpTrackPartsProps {
  track: SessionTrack;
  view: MinuteSpan;
  lines: number[];
  selected?: MinuteSpan;
}

const spanText = (s: MinuteSpan) => `${hhmm(s.start)} – ${hhmm(s.end)}`;

/** "08:30" with " – 09:00" the CSS drops when the block is too short for it. */
function RangeLabel({ range, className, endClassName }: { range: MinuteSpan; className: string; endClassName: string }) {
  return (
    <span className={className}>
      {hhmm(range.start)}
      <span className={endClassName}> – {hhmm(range.end)}</span>
    </span>
  );
}

/**
 * What a session's bar draws over the part of the shift in view: grid
 * lines, what cannot be booked (hatched), booked visits (amber) and the
 * picked range (indigo, with its edges as grips).
 */
export function FollowUpTrackParts({ track, view, lines, selected }: FollowUpTrackPartsProps) {
  const booked = t("Reception:FollowUpBooked");
  const hasOpen = track.open.length > 0;

  return (
    <>
      {lines.map((m) => (
        <span key={m} className={`fu-at fu-grid${m % 60 === 0 ? " fu-grid--hour" : ""}`} style={placed(view, { start: m, end: m })} />
      ))}
      {hasOpen &&
        track.closed.map((c) => (
          <span key={c.start} className="fu-at fu-off" style={placed(view, c)} title={t("Reception:FollowUpLegendOff")} />
        ))}
      {/* Two visits may share a start: the doctor can be double-booked. */}
      {track.booked.map((b, i) => (
        <span key={`${b.start}-${b.end}-${i}`} className="fu-at fu-booked" style={placed(view, b)} title={`${spanText(b)} · ${booked}`}>
          <RangeLabel range={b} className="fu-booked-time" endClassName="fu-booked-end" />
          <span className="fu-booked-note">{booked}</span>
        </span>
      ))}
      {selected && (
        <span className="fu-at fu-sel" style={placed(view, selected)}>
          <span className="fu-sel-grip fu-sel-grip--start" />
          <RangeLabel range={selected} className="fu-sel-text" endClassName="fu-sel-text-end" />
          <span className="fu-sel-grip fu-sel-grip--end" />
        </span>
      )}
    </>
  );
}
