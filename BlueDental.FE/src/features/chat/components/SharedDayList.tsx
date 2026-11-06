import type { ReactNode } from "react";
import type { DayGroup } from "../utils/chatShared";

interface SharedDayListProps<T> {
  groups: DayGroup<T>[];
  /** Pictures sit in a square grid; files and links one per row. */
  layout: "grid" | "rows";
  renderItem: (item: T) => ReactNode;
}

/** Kho lưu trữ items under a heading per day ("Ngày 06 Tháng 11"), newest day first. */
export function SharedDayList<T>({ groups, layout, renderItem }: SharedDayListProps<T>) {
  return (
    <>
      {groups.map((group) => (
        <section key={group.key} className="chat-shared-day" aria-label={group.heading}>
          <h3 className="chat-shared-day-heading">{group.heading}</h3>
          {layout === "grid" ? (
            <div className="chat-shared-grid">{group.items.map(renderItem)}</div>
          ) : (
            <ul className="chat-shared-rows">{group.items.map(renderItem)}</ul>
          )}
        </section>
      ))}
    </>
  );
}
