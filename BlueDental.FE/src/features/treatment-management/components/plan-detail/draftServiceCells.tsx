import type { ReactNode } from "react";
import { Input, InputNumber } from "antd";
import { Check, CircleAlert, Loader2, X } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  useDentistOptions,
  useDiagnosisOptions,
  useStaffOptionsSearch,
} from "@/hooks/usePickerOptions";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { jawLabel } from "@/components/ToothChart";
import { moneyText } from "../plan/planTypes";
import type { ToothPickerValue } from "../plan/toothPicker";
import { DiscountBreakdown } from "./DiscountBreakdown";
import { DraftStatusPill } from "./DraftStatusPill";
import { draftDiscountParts } from "./planDetailTypes";
import type { DraftIdField, DraftServiceController } from "./useDraftServiceRow";

type IdField = DraftIdField;

/**
 * The Răng cell's text once teeth are picked: tooth numbers only, or the jaw's
 * name — staging's `getSelectedToothCodesDisplay`, which prints no surfaces
 * here even when the chart recorded them (measured 2026-09-24).
 */
function toothCodesText(value: ToothPickerValue): string | null {
  if (value.kind === "jaw") return jawLabel(value.jaw);
  if (value.teeth.length === 0) return null;
  return value.teeth.map((pick) => pick.fdi).join(", ");
}

interface DraftProps {
  draft: DraftServiceController;
}

/** Service name, today's date and the status pill — the first cell of the new row. */
function DraftNameCell({ draft }: DraftProps) {
  return (
    <div className="pdt-service">
      <span className="pdt-service-name">{draft.service.name}</span>
      <span className="pdt-service-meta">
        <span className="pdt-service-date">{formatDate(new Date())}</span>
        <DraftStatusPill value={draft.values.status} onChange={(status) => draft.update("status", status)} />
      </span>
    </div>
  );
}

/**
 * One of the people / diagnosis pickers. Each asks its own endpoint for what
 * was typed — the row sits over a whole catalog, which no prefetched page can
 * stand in for.
 */
function IdSelect({
  draft,
  field,
  useOptions,
  placeholder,
}: DraftProps & {
  field: IdField;
  useOptions: (search: string, enabled: boolean) => {
    options: { value: string; label: string }[];
    loading: boolean;
  };
  placeholder: string;
}) {
  return (
    <div className="pdt-draft-select">
      <ServerSearchSelect
        value={draft.values[field] ?? undefined}
        valueLabel={draft.labels?.[field]}
        aria-label={placeholder}
        useOptions={useOptions}
        onChange={(value) => draft.update(field, value ?? null)}
      />
    </div>
  );
}

/** A value a line in treatment keeps, with staging's reason under it. */
function LockedCell({ value, reason }: { value: string; reason: string }) {
  return (
    <div className="pdt-draft-locked">
      <span>{value}</span>
      <small>{reason}</small>
    </div>
  );
}

function DraftTeethCell({ draft }: DraftProps) {
  const teeth = toothCodesText(draft.values.teeth);
  const error = draft.errors?.teeth;
  return (
    <div className="pdt-draft-teethcell">
      <div className="pdt-draft-teeth">
        <button
          type="button"
          className={error ? "tp-tooth-btn pdt-draft-teeth-btn--error" : "tp-tooth-btn"}
          aria-label={t("Treatment:Tooth:SelectTooth")}
          aria-invalid={Boolean(error)}
          onClick={draft.openTeeth}
        >
          <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
        </button>
        {teeth && <span className="pdt-draft-teeth-text">{teeth}</span>}
      </div>
      {error && (
        <p className="pdt-draft-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Đơn giá on the inline row. Staging refuses a price above the giá gốc on ✓
 * and prints "Đơn giá không được lớn hơn giá gốc của dịch vụ." in red under a
 * red input (owner's screenshot 2026-09-28).
 */
function DraftPriceCell({ draft }: DraftProps) {
  const error = draft.errors?.price;
  return (
    <div className="pdt-draft-pricecell">
      <CurrencyInput
        className="pdt-draft-price"
        status={error ? "error" : undefined}
        placeholder={t("Treatment:Pricing:UnitPrice")}
        aria-label={t("Treatment:Pricing:UnitPrice")}
        aria-invalid={Boolean(error)}
        value={draft.values.price}
        onChange={(value) => draft.update("price", value ?? 0)}
      />
      {error && (
        <p className="pdt-draft-error" role="alert">
          <CircleAlert size={14} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

function DraftActionsCell({ draft }: DraftProps) {
  return (
    <span className="pdt-row-actions">
      <button
        type="button"
        className="pdt-row-save"
        aria-label={t("Common:Save")}
        disabled={draft.saving}
        onClick={draft.save}
      >
        {draft.saving ? (
          <Loader2 size={18} className="pdt-spin" aria-hidden="true" />
        ) : (
          <Check size={18} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="pdt-row-cancel"
        aria-label={t("Common:Cancel")}
        disabled={draft.saving}
        onClick={draft.cancel}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </span>
  );
}

type DraftCell = (draft: DraftServiceController) => ReactNode;

/** What the new row shows in each column, keyed by the column key. */
const DRAFT_CELLS: Record<string, DraftCell> = {
  grip: () => null,
  service: (draft) => <DraftNameCell draft={draft} />,
  diagnosis: (draft) =>
    draft.locks ? (
      <LockedCell value={draft.locks.diagnosisName ?? "—"} reason={t("Treatment:Service:DiagnosisLocked")} />
    ) : (
      <IdSelect draft={draft} field="diagnosisId" useOptions={useDiagnosisOptions} placeholder={t("Treatment:Diagnosis:Diagnosis")} />
    ),
  dentist: (draft) => (
    <IdSelect draft={draft} field="dentistId" useOptions={useDentistOptions} placeholder={t("Treatment:Common:Doctor")} />
  ),
  teeth: (draft) => <DraftTeethCell draft={draft} />,
  quantity: (draft) => (
    <InputNumber
      className="pdt-draft-qty"
      min={1}
      precision={0}
      aria-label={t("Treatment:Pricing:Quantity")}
      value={draft.values.quantity}
      onChange={(value) => draft.update("quantity", value ?? 1)}
    />
  ),
  price: (draft) =>
    draft.locks ? (
      <LockedCell value={moneyText(draft.locks.price)} reason={t("Treatment:Service:PriceLocked")} />
    ) : (
      <DraftPriceCell draft={draft} />
    ),
  // Only the new row reaches this cell — an edited line keeps its saved
  // Tổng giảm giá until it is saved, as on staging.
  discount: (draft) => (
    <DiscountBreakdown
      parts={draftDiscountParts(draft.originalPrice, draft.values.price, draft.values.quantity)}
    />
  ),
  // Staging's onDraftChange: the saved figure until price, quantity or teeth
  // change, then đơn giá × số lượng as it is typed (2026-09-28).
  amount: (draft) => (
    <strong>{moneyText(draft.savedAmount ?? draft.values.price * draft.values.quantity)}</strong>
  ),
  note: (draft) => (
    <Input
      placeholder={t("Treatment:Common:Note")}
      aria-label={t("Treatment:Common:Note")}
      value={draft.values.note}
      onChange={(event) => draft.update("note", event.target.value)}
    />
  ),
  diagnoser1: (draft) => (
    <IdSelect draft={draft} field="diagnoserStaffId" useOptions={useDentistOptions} placeholder={t("Treatment:Diagnosis:DiagnoserShort1")} />
  ),
  diagnoser2: (draft) => (
    <IdSelect
      draft={draft}
      field="secondDiagnoserStaffId"
      useOptions={useDentistOptions}
      placeholder={t("Treatment:Diagnosis:DiagnoserShort2")}
    />
  ),
  consultant1: (draft) => (
    <IdSelect draft={draft} field="consultantStaffId" useOptions={useStaffOptionsSearch} placeholder={t("Treatment:Common:Advisor1Short")} />
  ),
  consultant2: (draft) => (
    <IdSelect
      draft={draft}
      field="secondConsultantStaffId"
      useOptions={useStaffOptionsSearch}
      placeholder={t("Treatment:Common:Advisor2Short")}
    />
  ),
  actions: (draft) => <DraftActionsCell draft={draft} />,
};

export function renderDraftCell(columnKey: string, draft: DraftServiceController): ReactNode {
  const cell = DRAFT_CELLS[columnKey];
  return cell ? cell(draft) : null;
}
