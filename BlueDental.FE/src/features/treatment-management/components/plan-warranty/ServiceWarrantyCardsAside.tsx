import { WarrantyCardFace, type WarrantyFace } from "@/features/labo/components/warranty/WarrantyCardFace";
import type { WarrantyCardRowDto, WarrantyServiceRowDto } from "../../api/planWarrantyApi";
import { dentalCardFace, pendingDentalFace } from "./dentalCardView";
import { NO_TOOTH } from "./useServiceWarrantyForm";

interface Props {
  row: WarrantyServiceRowDto;
  /** The line's dental cards already activated. */
  cards: WarrantyCardRowDto[];
  /** Teeth the shared preview already stands for. */
  leaveOut: number[];
  today: string;
  logoUrl: string;
}

interface Entry {
  key: string;
  tooth: number;
  face: WarrantyFace;
}

/**
 * The right column, as on Labo's Kích hoạt bảo hành: the line's cards by
 * tooth — purple once activated, grey while waiting.
 */
export function ServiceWarrantyCardsAside({ row, cards, leaveOut, today, logoUrl }: Props) {
  const activated: Entry[] = cards.map((card) => ({
    key: card.code,
    tooth: card.toothNumber ?? NO_TOOTH,
    face: dentalCardFace(card, today),
  }));
  const pending: Entry[] = row.dentalPendingTeeth
    .filter((tooth) => !leaveOut.includes(tooth ?? NO_TOOTH))
    .map((tooth) => ({
      key: `pending-${tooth ?? NO_TOOTH}`,
      tooth: tooth ?? NO_TOOTH,
      face: pendingDentalFace(row.serviceName, tooth),
    }));
  const entries = [...activated, ...pending].sort((a, b) => a.tooth - b.tooth);

  return (
    <div className="pd-labo-warranty-cards pd-labo-warranty-cards--stack">
      {entries.map((entry) => (
        <WarrantyCardFace key={entry.key} face={entry.face} logoUrl={logoUrl} />
      ))}
    </div>
  );
}
