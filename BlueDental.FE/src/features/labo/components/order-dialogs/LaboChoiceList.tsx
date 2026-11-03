import { t } from "@/lib/i18n";
import { choiceSections, type LaboChoiceItem } from "./laboChoice";

interface Props {
  items: LaboChoiceItem[];
  picked: string | undefined;
  /** The popup's own label, so the radio group reads as "Chọn dịch vụ Labo". */
  label: string;
  onPick: (value: string) => void;
  /** A double click picks and closes, as the footer button would. */
  onConfirm: (value: string) => void;
}

/**
 * The popup's scroll list (P3110 m158): a radio per choice, bold name, grey
 * line under it and the count on the right, under uppercase section headers
 * when the catalog groups its choices. Only one may be picked (REQ-C5).
 */
export function LaboChoiceList({ items, picked, label, onPick, onConfirm }: Props) {
  if (items.length === 0) return <p className="pd-labo-pick-none">{t("Common:NoData")}</p>;

  return (
    <div className="pd-labo-pick-list" role="radiogroup" aria-label={label}>
      {choiceSections(items).map((section) => (
        <section key={section.name || "-"}>
          {section.name && (
            <h4 className="pd-labo-pick-section">
              {section.name} · {section.items.length}
            </h4>
          )}
          {section.items.map((item) => {
            const on = item.value === picked;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={on}
                key={item.value}
                className={on ? "pd-labo-pick-row pd-labo-pick-row--on" : "pd-labo-pick-row"}
                onClick={() => onPick(item.value)}
                onDoubleClick={() => onConfirm(item.value)}
              >
                <span className="pd-labo-pick-radio" aria-hidden />
                <span className="pd-labo-pick-text">
                  <b>{item.label}</b>
                  {item.description && <small>{item.description}</small>}
                </span>
                {item.extra && <span className="pd-labo-pick-extra">{item.extra}</span>}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
