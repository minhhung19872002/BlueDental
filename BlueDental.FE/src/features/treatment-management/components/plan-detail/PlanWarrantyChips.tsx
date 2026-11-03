import { t } from "@/lib/i18n";
import {
  WARRANTY_CELL,
  type WarrantyCellState,
  type WarrantyServiceRowDto,
} from "../../api/planWarrantyApi";

const CHIP_TONE: Record<WarrantyCellState, string> = {
  [WARRANTY_CELL.None]: "",
  [WARRANTY_CELL.NotEligible]: "muted",
  [WARRANTY_CELL.Pending]: "pending",
  [WARRANTY_CELL.Activated]: "active",
};

function stateLabel(state: WarrantyCellState): string {
  if (state === WARRANTY_CELL.Pending) return t("Labo:Warranty:AwaitingActivation");
  if (state === WARRANTY_CELL.Activated) return t("Treatment:Warranty:Filter:Activated");
  return t("Treatment:Warranty:Cell:NotEligible");
}

function Chip({ kind, state }: { kind: "dental" | "labo"; state: WarrantyCellState }) {
  const kindLabel = kind === "dental" ? t("Treatment:Warranty:Kind:Dental") : t("Treatment:Warranty:Kind:Labo");
  return (
    <span className={`pdt-wchip pdt-wchip--${kind} pdt-wchip--${CHIP_TONE[state]}`}>
      {t("Treatment:PlanDetail:WarrantyChip", kindLabel, stateLabel(state))}
    </span>
  );
}

/**
 * "Bảo hành" on the slip's service table (P3110 REQ-A10, m390): up to two
 * chips — Nha khoa, and Labo only on a line with a Labo order — in the Bảo
 * hành tab's tones; "–" on a line with neither. No second line, no YCBH (D6).
 */
export function PlanWarrantyChips({ row }: { row: WarrantyServiceRowDto | undefined }) {
  const dental = row?.dental ?? WARRANTY_CELL.None;
  const labo = row?.labo ?? WARRANTY_CELL.None;
  if (dental === WARRANTY_CELL.None && labo === WARRANTY_CELL.None) return <span className="pdt-wchip-none">–</span>;
  return (
    <span className="pdt-wchips">
      {dental !== WARRANTY_CELL.None && <Chip kind="dental" state={dental} />}
      {labo !== WARRANTY_CELL.None && <Chip kind="labo" state={labo} />}
    </span>
  );
}
