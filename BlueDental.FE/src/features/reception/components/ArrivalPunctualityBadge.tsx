import React from "react";
import { t } from "@/lib/i18n";
import type { ArrivalPunctuality, PunctualitySpan } from "../utils/arrivalPunctuality";

interface ArrivalPunctualityBadgeProps {
  punctuality: ArrivalPunctuality;
  /** Booked and arrived, HH:mm — the hover hint. */
  bookedTime: string;
  arrivedTime: string;
}

const DIRECTION_KEY: Record<ArrivalPunctuality["direction"], string> = {
  late: "Reception:PunctualityLate",
  early: "Reception:PunctualityEarly",
};

/** "8p", "1g20p", "2g", "1 ngày" — the owner's "1g20p" from an hour up (2026-11-09). */
function formatSpan(span: PunctualitySpan): string {
  if (span.unit === "days") return t("Reception:PunctualityDays", span.value);
  if (span.value < 60) return t("Reception:PunctualityMinutes", span.value);
  const hours = Math.floor(span.value / 60);
  const minutes = span.value % 60;
  if (minutes === 0) return t("Reception:PunctualityHours", hours);
  return t("Reception:PunctualityHoursMinutes", hours, String(minutes).padStart(2, "0"));
}

/** "Trễ 8p" red / "Sớm 5p" green beside the booked time on the "Khách đã đến" panel (R-1183). */
export const ArrivalPunctualityBadge: React.FC<ArrivalPunctualityBadgeProps> = ({
  punctuality,
  bookedTime,
  arrivedTime,
}) => (
  <span
    className={`arrival-row-punctuality arrival-row-punctuality--${punctuality.direction}`}
    title={t("Reception:PunctualityHint", bookedTime, arrivedTime)}
  >
    {t(DIRECTION_KEY[punctuality.direction], formatSpan(punctuality.span))}
  </span>
);
