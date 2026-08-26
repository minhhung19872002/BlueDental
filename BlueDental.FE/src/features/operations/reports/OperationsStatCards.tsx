import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface StatCard {
  key: string;
  value: string;
  label: string;
  icon: ReactNode;
  tone: "teal" | "blue" | "amber" | "green" | "rose";
  /** The pill under the figure, where the reference shows one. */
  badge?: { text: string; tone: "green" | "rose" };
  /** Set where the cards double as the report's filter. */
  active?: boolean;
  onSelect?: () => void;
}

interface Props {
  cards: StatCard[];
}

/**
 * The figures above a money report.
 *
 * On Truy cập these are also the filter — picking one narrows the list to it —
 * so a card becomes a button when it is given `onSelect`, and stays a plain
 * panel otherwise.
 */
export function OperationsStatCards({ cards }: Props) {
  return (
    <div className="bd-ops-stats">
      {cards.map((card) => {
        const body = (
          <>
            <span className={cn("bd-ops-stat-icon", `bd-ops-stat-icon--${card.tone}`)}>
              {card.icon}
            </span>
            <span className="bd-ops-stat-body">
              <span className={cn("bd-ops-stat-value", `bd-ops-stat-value--${card.tone}`)}>
                {card.value}
              </span>
              <span className="bd-ops-stat-label">{card.label}</span>
              {card.badge ? (
                <span className={cn("bd-ops-stat-badge", `bd-ops-stat-badge--${card.badge.tone}`)}>
                  {card.badge.text}
                </span>
              ) : null}
            </span>
          </>
        );

        if (!card.onSelect) {
          return (
            <div key={card.key} className="bd-ops-stat">
              {body}
            </div>
          );
        }

        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={card.active}
            className={cn("bd-ops-stat", "bd-ops-stat--pick", card.active && "bd-ops-stat--active")}
            onClick={card.onSelect}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
