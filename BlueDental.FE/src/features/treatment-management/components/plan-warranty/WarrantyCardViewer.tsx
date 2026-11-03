import { LaboWorkflowDialog, type LaboWorkflowPatient } from "@/features/labo/components/workflow/LaboWorkflowDialog";
import { WARRANTY_CARD_KIND, type PlanWarrantyOverviewDto, type WarrantyCardRowDto } from "../../api/planWarrantyApi";
import { DentalCardsViewDialog } from "./DentalCardsViewDialog";

interface Props {
  /** The card whose "Xem chi tiết" was pressed; null keeps both viewers shut. */
  card: WarrantyCardRowDto | null;
  overview: PlanWarrantyOverviewDto;
  branchId: string;
  patient: LaboWorkflowPatient;
  onClose: () => void;
}

/**
 * "Xem chi tiết" (R-1120), view only: a Labo card reopens its order on tab
 * Bảo hành with nothing to press but In phiếu Labo; a dental card shows its
 * line's cards on the same frame. Kept off the URL so a reload never lands
 * back on a dialog.
 */
export function WarrantyCardViewer({ card, overview, branchId, patient, onClose }: Props) {
  if (!card) return null;
  if (card.kind === WARRANTY_CARD_KIND.Labo && card.laboOrderId) {
    return (
      <LaboWorkflowDialog
        target={{ kind: "open", orderId: card.laboOrderId, step: "warranty", readOnly: true, focusTooth: card.toothNumber }}
        branchId={branchId}
        patient={patient}
        onClose={onClose}
      />
    );
  }
  const cards = overview.cards.filter((row) => row.kind === card.kind && row.lineId === card.lineId);
  return (
    <DentalCardsViewDialog
      card={card}
      cards={cards}
      line={overview.rows.find((row) => row.lineId === card.lineId)}
      today={overview.today}
      onClose={onClose}
    />
  );
}
