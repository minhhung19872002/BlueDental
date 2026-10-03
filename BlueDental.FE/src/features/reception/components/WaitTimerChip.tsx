import { Hourglass, TriangleAlert } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatElapsed, type WaitLevel } from "../utils/waitTime";

interface WaitTimerChipProps {
  level: WaitLevel;
  elapsedSeconds: number;
}

/** "Đang chờ mm:ss" on the line between "Đã đến" and "Đang khám". */
export function WaitTimerChip({ level, elapsedSeconds }: WaitTimerChipProps) {
  const elapsed = formatElapsed(elapsedSeconds);
  const overdue = level === "overdue";
  const Icon = overdue ? TriangleAlert : Hourglass;

  return (
    <span className={`rc-wait-chip rc-wait-chip--${level}`} role="timer">
      <Icon size={12} aria-hidden />
      {overdue ? t("Reception:WaitingTooLong", elapsed) : t("Reception:WaitingFor", elapsed)}
    </span>
  );
}
