export type CellKind =
  | "empty-future"
  | "empty-past"
  | "vang"
  | "working"
  | "day-off"
  | "locked";

const KIND_CLASS: Record<CellKind, string> = {
  "empty-future": "wsb-cell",
  "empty-past": "wsb-cell wsb-cell--past-empty",
  vang: "wsb-cell wsb-cell--vang",
  working: "wsb-cell wsb-cell--working",
  "day-off": "wsb-cell wsb-cell--day-off",
  locked: "wsb-cell wsb-cell--locked",
};

const KIND_LABEL: Record<CellKind, string> = {
  "empty-future": "",
  "empty-past": "",
  vang: "V",
  working: "L",
  "day-off": "X",
  locked: "",
};

interface Props {
  kind: CellKind;
  disabled?: boolean;
  onClick?: () => void;
}

export function WorkScheduleCell({ kind, disabled, onClick }: Props) {
  const isDisabled = disabled || kind === "empty-past" || kind === "vang" || kind === "locked";

  return (
    <button
      type="button"
      className={KIND_CLASS[kind]}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
    >
      {KIND_LABEL[kind]}
    </button>
  );
}
