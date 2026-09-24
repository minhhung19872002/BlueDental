import { t } from "@/lib/i18n";
import type { StageItem } from "./stageModel";

interface Props {
  items: StageItem[];
  selectedIds: string[];
  emptyText: string;
  onToggle: (id: string) => void;
}

/**
 * The Chi tiết column: one card per line (THÊM CÔNG ĐOẠN) or per công đoạn
 * being worked (the two continue tabs). A click opens the card's form and a
 * second click closes it again, so several can be open at once — measured on
 * staging 2026-09-24. The teeth are numbers only: on `add` the ones still to
 * start, otherwise the công đoạn's own.
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
            data-stage-id={item.stage?.id}
            className={active ? "active" : undefined}
            aria-pressed={active}
            onClick={() => onToggle(item.id)}
          >
            <strong>{item.line.serviceName ?? item.line.code}</strong>
            <span>
              {t("Patient:DentalChart:Tooth")}:
              {item.teeth.map((tooth) => (
                <i key={tooth.toothCode}>{tooth.toothCode}</i>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
