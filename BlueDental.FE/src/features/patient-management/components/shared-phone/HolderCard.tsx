import type { ReactNode } from "react";
import { initialsOf } from "../../utils/guardian";
import "./shared-phone.css";

export type HolderChipTone = "owner" | "plain";

export interface HolderChip {
  label: string;
  tone: HolderChipTone;
}

interface Props {
  name: string;
  chip?: HolderChip | null;
  meta: string;
  /** Beside the body: "Mở hồ sơ ›", a debt, a chevron. Kept outside the card's own button. */
  trailing?: ReactNode;
  /** Makes the avatar and body one button; absent leaves them inert. */
  onSelect?: () => void;
  className?: string;
}

/** The round initials badge of a person on the number — also worn by the guardian card. */
export function HolderAvatar({ name }: { name: string }) {
  return (
    <span className="bd-holder-avatar" aria-hidden>
      {initialsOf(name)}
    </span>
  );
}

export function HolderChipTag({ chip }: { chip: HolderChip }) {
  return <span className={`bd-holder-chip bd-holder-chip--${chip.tone}`}>{chip.label}</span>;
}

/**
 * One person on a shared number (P2710_02): the phone dropdown's rows and the
 * Hồ sơ tab's "Người dùng chung SĐT" cards. Avatar, name with its chip, then a
 * "mã · tuổi · khám gần nhất" line.
 */
export function HolderCard({ name, chip, meta, trailing, onSelect, className }: Props) {
  const content = (
    <>
      <HolderAvatar name={name} />
      <span className="bd-holder-body">
        <span className="bd-holder-head">
          <span className="bd-holder-name">{name}</span>
          {chip && <HolderChipTag chip={chip} />}
        </span>
        {meta && <span className="bd-holder-meta">{meta}</span>}
      </span>
    </>
  );

  return (
    <div className={["bd-holder", className].filter(Boolean).join(" ")}>
      {onSelect ? (
        <button type="button" className="bd-holder-main" onClick={onSelect}>
          {content}
        </button>
      ) : (
        <div className="bd-holder-main">{content}</div>
      )}
      {trailing && <div className="bd-holder-trailing">{trailing}</div>}
    </div>
  );
}
