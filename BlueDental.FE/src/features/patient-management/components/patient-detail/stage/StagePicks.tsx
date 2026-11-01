import { jawLabel, wholeJawOf } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import type { StageItem } from "./stageModel";

interface Props {
  items: StageItem[];
  selectedIds: string[];
  emptyText: string;
  onToggle: (id: string) => void;
}

/**
 * The teeth on a card: a line picked as a whole jaw by the jaw's name, one
 * chip — "Hàm trên", "Hàm dưới", "Hai hàm" (clinic, 2026-11-01, R-1096); the
 * form beside it still lists the jaw tooth by tooth. Otherwise the numbers,
 * those this card can take in blue, the rest — already taken by a công đoạn — faded.
 */
function PickTeeth({ item }: { item: StageItem }) {
  const jaw = wholeJawOf(item.shownTeeth);
  if (jaw) return <i>{jawLabel(jaw)}</i>;

  return item.shownTeeth.map((tooth) => {
    const free = item.teeth.some((each) => each.toothCode === tooth.toothCode);
    return (
      <i key={tooth.toothCode} className={free ? undefined : "pd-stage-tooth--done"}>
        {tooth.toothCode}
      </i>
    );
  });
}

/**
 * The Chi tiết column: one card per service line on every tab. A click opens
 * the card's form and a second click closes it; opening another closes the
 * first. The teeth are all of the line's (see `PickTeeth`).
 */
export function StagePicks({ items, selectedIds, emptyText, onToggle }: Props) {
  if (items.length === 0) return <p className="pd-stage-empty">{emptyText}</p>;

  return (
    <div className="pd-stage-picks">
      {items.map((item) => {
        const active = selectedIds.includes(item.id);
        return (
          <button
            type="button"
            key={item.id}
            /* Which service line the card stands for — the history rows and
               the treatment table are addressed the same way. */
            data-line-id={item.line.id}
            data-stage-id={item.stages.map((stage) => stage.id).join(" ") || undefined}
            className={active ? "active" : undefined}
            aria-pressed={active}
            onClick={() => onToggle(item.id)}
          >
            <strong>{item.line.serviceName ?? item.line.code}</strong>
            <span>
              {t("Patient:DentalChart:Tooth")}:
              <PickTeeth item={item} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
