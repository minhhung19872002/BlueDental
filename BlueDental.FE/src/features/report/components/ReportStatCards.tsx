import type { ReactNode } from "react";
import { formatVND } from "@/utils/format";

export type StatTone = "green" | "blue" | "gold" | "red" | "ink";

export interface StatCardItem {
  label: string;
  value: number;
  tone: StatTone;
  icon?: ReactNode;
}

type Props =
  | {
      /** Small centred tiles that sit on the headline row (tab 1). */
      variant: "compact";
      items: StatCardItem[];
    }
  | {
      /** Icon + value + label cards laid out on a grid (tab 2). */
      variant: "icon";
      items: StatCardItem[];
      columns: 3 | 4 | 5;
    };

function CompactCard({ item }: { item: StatCardItem }) {
  return (
    <div className={`report-stat-tile report-stat-tile--${item.tone}`}>
      <div className="report-stat-tile-value">{formatVND(item.value)} đ</div>
      <div className="report-stat-tile-label">{item.label}</div>
    </div>
  );
}

function IconCard({ item }: { item: StatCardItem }) {
  return (
    <div className={`report-stat-card report-stat-card--${item.tone}`}>
      {item.icon && <span className="report-stat-card-icon">{item.icon}</span>}
      <div className="report-stat-card-body">
        <div className="report-stat-card-value">{formatVND(item.value)} đ</div>
        <div className="report-stat-card-label">{item.label}</div>
      </div>
    </div>
  );
}

/** Money summary cards above a report table (Tiền Mặt / Chuyển Khoản / …). */
export function ReportStatCards(props: Props) {
  if (props.variant === "compact") {
    return (
      <div className="report-stat-tiles">
        {props.items.map((item) => (
          <CompactCard key={item.label} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className={`report-stat-row report-stat-row--${props.columns}`}>
      {props.items.map((item) => (
        <IconCard key={item.label} item={item} />
      ))}
    </div>
  );
}
