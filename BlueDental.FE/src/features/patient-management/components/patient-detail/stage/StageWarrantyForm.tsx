import {
  WARRANTY_CARD_KIND,
  type WarrantyCardKind,
  type WarrantyServiceRowDto,
} from "@/features/treatment-management/api/planWarrantyApi";
import type { ToothSelectionDto } from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { StageContentColumn } from "./StageContentColumn";
import type { StageFormHandlers } from "./StageForm";
import { StageLaboWarrantySelect } from "./StageLaboWarrantySelect";
import { StageRemarkColumn, type StageFormActions } from "./StageRemarkColumn";
import { StageStaffColumn } from "./StageStaffColumn";
import { StageTeethRow } from "./StageTeethRow";
import { StageWarrantyCardPick } from "./StageWarrantyCardPick";
import type { StageDraft } from "./stageDraft";
import type { StageFieldErrors } from "./stageFieldErrors";
import { toggleTooth, type StageItem } from "./stageModel";
import type { LineCover } from "./stageWarranty";
import "./stage-warranty.css";

/** What the warranty form reads beyond the draft: the line's valid cards. */
export interface StageWarrantyContext {
  cover: LineCover | undefined;
  /** The line's row of the Bảo hành tab — finished on, by whom. */
  row: WarrantyServiceRowDto | undefined;
  /** The teeth the picked card covers. */
  offered: ToothSelectionDto[];
  onPick: (kind: WarrantyCardKind | undefined, laboOrderId?: string) => void;
}

interface Props {
  item: StageItem;
  draft: StageDraft;
  errors: StageFieldErrors;
  handlers: StageFormHandlers;
  warranty: StageWarrantyContext;
  actions?: StageFormActions;
}

/** `Hoàn thành 06/11/2026 · BS. Nguyễn Lan Chi`, each half only when known. */
function finishedText(row: WarrantyServiceRowDto | undefined) {
  if (!row) return "";
  return [
    row.completedOn && t("Patient:Stage:WarrantyFinishedOn", formatDate(row.completedOn)),
    row.dentistName && t("Treatment:Warranty:Dentist", row.dentistName),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * A TIẾP TỤC BẢO HÀNH form (P3110 REQ-F1…F6, m390/m394/m395/m412/m415): the
 * same columns as every công đoạn form. Since "Dịch vụ đã chọn" went (owner,
 * 2026-11-11, R-1206), Nội dung điều trị opens with when the line was finished,
 * "Thẻ bảo hành áp dụng", the Răng line and, for a Labo card, the order picked.
 * A chain already open keeps its card and order.
 */
export function StageWarrantyForm({ item, draft, errors, handlers, warranty, actions }: Props) {
  const locked = item.stages.length > 0;
  const isLabo = draft.warrantyKind === WARRANTY_CARD_KIND.Labo;
  const offeredCodes = new Set(warranty.offered.map((tooth) => tooth.toothCode));
  const finished = finishedText(warranty.row);

  return (
    <div className="pd-stage-form pd-stage-form--four pd-stage-form--warranty" data-item-id={item.id}>
      <StageStaffColumn draft={draft} errors={errors} onChange={handlers.onChange} />

      <StageContentColumn
        steps={item.line.serviceSteps ?? []}
        draft={draft}
        error={errors.note}
        onChange={handlers.onChange}
        onPickSteps={handlers.onPickSteps}
        placeholder={t("Patient:Stage:WarrantyContentPlaceholder")}
      >
        {finished && <p className="pd-wform-sub">{finished}</p>}
        <StageWarrantyCardPick
          cover={warranty.cover}
          picked={draft.warrantyKind}
          locked={locked}
          error={errors.warranty}
          onPick={(kind) => warranty.onPick(kind)}
        />
        <StageTeethRow
          candidates={warranty.offered}
          shown={item.shownTeeth}
          picked={draft.teeth}
          error={errors.teeth}
          onToggle={(code) => handlers.onChange({ teeth: toggleTooth(draft.teeth, code) })}
          onChange={(teeth) => handlers.onChange({ teeth: teeth.filter((code) => offeredCodes.has(code)) })}
        />
        {isLabo && (
          <StageLaboWarrantySelect
            options={warranty.cover?.labo ?? []}
            value={draft.warrantyLaboOrderId}
            locked={locked}
            error={errors.laboOrder}
            onChange={(orderId) => warranty.onPick(WARRANTY_CARD_KIND.Labo, orderId)}
          />
        )}
      </StageContentColumn>

      <StageRemarkColumn draft={draft} onChange={handlers.onChange} actions={actions} />
    </div>
  );
}
