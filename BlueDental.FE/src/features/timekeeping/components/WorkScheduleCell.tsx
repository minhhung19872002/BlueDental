import type { ReactNode } from "react";

import { MoonIcon, SunIcon } from "./ScheduleIcons";
import { t } from "@/lib/i18n";

export type CellKind =
  | "empty-future"
  | "empty-past"
  | "vang"
  | "working"
  | "day-off"
  | "half-morning"
  | "half-afternoon"
  | "locked";

const KIND_CLASS: Record<CellKind, string> = {
  "empty-future": "wsb-cell",
  "empty-past": "wsb-cell wsb-cell--past-empty",
  vang: "wsb-cell wsb-cell--vang",
  working: "wsb-cell wsb-cell--working",
  "day-off": "wsb-cell wsb-cell--day-off",
  "half-morning": "wsb-cell wsb-cell--half",
  "half-afternoon": "wsb-cell wsb-cell--half",
  locked: "wsb-cell wsb-cell--locked",
};

const KIND_LABEL: Record<CellKind, ReactNode> = {
  "empty-future": "",
  "empty-past": "",
  vang: "V",
  working: "L",
  "day-off": "X",
  "half-morning": <SunIcon />,
  "half-afternoon": <MoonIcon />,
  locked: "",
};

const KIND_TITLE_KEY: Partial<Record<CellKind, string>> = {
  "half-morning": "Timekeeping:HalfDayMorning",
  "half-afternoon": "Timekeeping:HalfDayAfternoon",
};

interface Props {
  kind: CellKind;
  disabled: boolean;
  onClick: () => void;
}

export function WorkScheduleCell({ kind, disabled, onClick }: Props) {
  const titleKey = KIND_TITLE_KEY[kind];

  return (
    <button
      type="button"
      className={KIND_CLASS[kind]}
      disabled={disabled}
      title={titleKey ? t(titleKey) : undefined}
      onClick={onClick}
    >
      {KIND_LABEL[kind]}
    </button>
  );
}
