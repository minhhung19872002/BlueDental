import { t } from "@/lib/i18n";
import type { StageItem } from "./stageModel";

interface Props {
  items: StageItem[];
  selectedIds: string[];
  emptyText: string;
  onToggle: (id: string) => void;
}

/**
 * The Chi tiết column: one card per service line on every tab. A click opens
 * the card's form and a second click closes it; opening another closes the
 * first. The teeth are numbers only, all of the line's: those this card can
 * take in blue, the rest — already taken by a công đoạn — faded.
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
              {item.shownTeeth.map((tooth) => {
                const free = item.teeth.some((each) => each.toothCode === tooth.toothCode);
                return (
                  <i key={tooth.toothCode} className={free ? undefined : "pd-stage-tooth--done"}>
                    {tooth.toothCode}
                  </i>
                );
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
