import type { ReactNode } from "react";
import { Input, InputNumber, Select } from "antd";
import { Check, Loader2, X } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { StaffOption } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
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

/** One of the people / diagnosis pickers: a searchable select bound to an id field. */
function IdSelect({
  draft,
  field,
  options,
  placeholder,
}: DraftProps & { field: IdField; options: StaffOption[]; placeholder: string }) {
  return (
    <Select<string>
      className="pdt-draft-select"
      showSearch
      allowClear
      placeholder={placeholder}
      aria-label={placeholder}
      value={draft.values[field] ?? undefined}
      options={options}
      optionFilterProp="label"
      onChange={(value) => draft.update(field, value ?? null)}
    />
  );
}

function DraftTeethCell({ draft }: DraftProps) {
  const teeth = formatToothValue(draft.values.teeth);
  return (
    <div className="pdt-draft-teeth">
      <button type="button" className="tp-tooth-btn" aria-label={t("Chọn răng")} onClick={draft.openTeeth}>
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
        aria-label={t("Lưu")}
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
        aria-label={t("Hủy")}
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
    <IdSelect draft={draft} field="diagnosisId" options={draft.options.diagnoses} placeholder={t("Chẩn đoán")} />
  ),
  dentist: (draft) => (
    <IdSelect draft={draft} field="dentistId" options={draft.options.dentists} placeholder={t("Bác sĩ")} />
  ),
  teeth: (draft) => <DraftTeethCell draft={draft} />,
  quantity: (draft) => (
    <InputNumber
      className="pdt-draft-qty"
      min={1}
      precision={0}
      aria-label={t("Số lượng")}
      value={draft.values.quantity}
      onChange={(value) => draft.update("quantity", value ?? 1)}
    />
  ),
  price: (draft) => (
    <CurrencyInput
      className="pdt-draft-price"
      placeholder={t("Đơn giá")}
      aria-label={t("Đơn giá")}
      value={draft.values.price}
      onChange={(value) => draft.update("price", value ?? 0)}
    />
  ),
  discount: () => <span className="pdt-discount">{moneyText(0)}</span>,
  amount: (draft) => <strong>{moneyText(draft.values.price * draft.values.quantity)}</strong>,
  note: (draft) => (
    <Input
      placeholder={t("Ghi chú")}
      aria-label={t("Ghi chú")}
      value={draft.values.note}
      onChange={(event) => draft.update("note", event.target.value)}
    />
  ),
  diagnoser1: (draft) => (
    <IdSelect draft={draft} field="diagnoserStaffId" options={draft.options.staff} placeholder={t("BS chẩn đoán 1")} />
  ),
  diagnoser2: (draft) => (
    <IdSelect
      draft={draft}
      field="secondDiagnoserStaffId"
      options={draft.options.staff}
      placeholder={t("BS chẩn đoán 2")}
    />
  ),
  consultant1: (draft) => (
    <IdSelect draft={draft} field="consultantStaffId" options={draft.options.staff} placeholder={t("Tư vấn 1")} />
  ),
  consultant2: (draft) => (
    <IdSelect
      draft={draft}
      field="secondConsultantStaffId"
      options={draft.options.staff}
      placeholder={t("Tư vấn 2")}
    />
  ),
  actions: (draft) => <DraftActionsCell draft={draft} />,
};

export function renderDraftCell(columnKey: string, draft: DraftServiceController): ReactNode {
  const cell = DRAFT_CELLS[columnKey];
  return cell ? cell(draft) : null;
}
