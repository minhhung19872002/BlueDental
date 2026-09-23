import type { ReactNode } from "react";
import { Input, InputNumber } from "antd";
import { Check, Loader2, X } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  useDentistOptions,
  useDiagnosisOptions,
  useStaffOptionsSearch,
} from "@/hooks/usePickerOptions";
import { ServerSearchSelect } from "@/components/ServerSearchSelect";
import { moneyText } from "../plan/planTypes";
import { formatToothValue } from "../plan/toothPicker";
import { DraftStatusPill } from "./DraftStatusPill";
import type { DraftServiceController, DraftServiceValues } from "./useDraftServiceRow";

type IdField = {
  [K in keyof DraftServiceValues]: DraftServiceValues[K] extends string | null ? K : never;
}[keyof DraftServiceValues];

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
        aria-label={placeholder}
        useOptions={useOptions}
        onChange={(value) => draft.update(field, value ?? null)}
      />
    </div>
  );
}

function DraftTeethCell({ draft }: DraftProps) {
  const teeth = formatToothValue(draft.values.teeth);
  return (
    <div className="pdt-draft-teeth">
      <button type="button" className="tp-tooth-btn" aria-label={t("Treatment:Tooth:SelectTooth")} onClick={draft.openTeeth}>
        <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
      </button>
      {teeth && <span className="pdt-draft-teeth-text">{teeth}</span>}
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
  diagnosis: (draft) => (
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
  price: (draft) => (
    <CurrencyInput
      className="pdt-draft-price"
      placeholder={t("Treatment:Pricing:UnitPrice")}
      aria-label={t("Treatment:Pricing:UnitPrice")}
      value={draft.values.price}
      onChange={(value) => draft.update("price", value ?? 0)}
    />
  ),
  discount: () => <span className="pdt-discount">{moneyText(0)}</span>,
  amount: (draft) => <strong>{moneyText(draft.values.price * draft.values.quantity)}</strong>,
  note: (draft) => (
    <Input
      placeholder={t("Treatment:Common:Note")}
      aria-label={t("Treatment:Common:Note")}
      value={draft.values.note}
      onChange={(event) => draft.update("note", event.target.value)}
    />
  ),
  diagnoser1: (draft) => (
    <IdSelect draft={draft} field="diagnoserStaffId" useOptions={useStaffOptionsSearch} placeholder={t("Treatment:Diagnosis:DiagnoserShort1")} />
  ),
  diagnoser2: (draft) => (
    <IdSelect
      draft={draft}
      field="secondDiagnoserStaffId"
      useOptions={useStaffOptionsSearch}
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
