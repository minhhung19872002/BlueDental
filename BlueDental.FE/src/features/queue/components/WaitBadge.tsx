import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { WAIT_LEVEL_LABEL, WAIT_LEVELS, type WaitLevel } from "../utils/waitLevel";

interface WaitBadgeProps {
  level: WaitLevel;
  /** What the pill says; the level's name ("Quá ngưỡng") when left out. */
  children?: ReactNode;
}

/** A wait in the board's three colours: green, amber, red. */
export function WaitBadge({ level, children }: WaitBadgeProps) {
  return (
    <span className={`queue-wait queue-wait--${level}`}>
      {children ?? t(WAIT_LEVEL_LABEL[level])}
    </span>
  );
}

/** "● Bình thường ● Sắp quá ngưỡng ● Quá ngưỡng" — the key under the board's figures. */
export function WaitLegend() {
  return (
    <ul className="queue-legend" aria-label={t("Queue:Legend:Title")}>
      {WAIT_LEVELS.map((level) => (
        <li key={level} className={`queue-legend__item queue-legend__item--${level}`}>
          <span className="queue-legend__dot" aria-hidden />
          {t(`Queue:Legend:${level}`)}
        </li>
      ))}
    </ul>
  );
}
