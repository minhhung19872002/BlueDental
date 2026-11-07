import React from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import type { ArrivalCallAction, ArrivalCallSection } from "../types/arrivalCall";
import { ArrivalCallRow } from "./ArrivalCallRow";

interface ArrivalCallPanelProps {
  sections: ArrivalCallSection[];
  /** The row whose "Mời lên" / "Tiếp nhận" is in flight. */
  pendingId: string | null;
  onAction: (id: string, action: ArrivalCallAction) => void;
  /** A control at the right of a section's title bar: the 👁 on "Khách đã đến" (R-1164). */
  titleExtras?: Partial<Record<ArrivalCallAction, React.ReactNode>>;
}

const SectionBody: React.FC<
  { section: ArrivalCallSection } & Pick<ArrivalCallPanelProps, "pendingId" | "onAction">
> = ({ section, pendingId, onAction }) => {
  if (section.loading) {
    return (
      <div className="arrival-panel-empty">
        <Spin />
      </div>
    );
  }
  if (section.items.length === 0) {
    return <div className="arrival-panel-empty">{section.emptyText ?? t("Reception:ArrivalCallEmpty")}</div>;
  }
  return (
    <ul className="arrival-panel-list">
      {section.items.map((item) => (
        <ArrivalCallRow
          key={item.id}
          item={item}
          action={section.action}
          canAct={section.canAct(item)}
          pending={pendingId === item.id}
          onAction={onAction}
        />
      ))}
    </ul>
  );
};

export const ArrivalCallPanel: React.FC<ArrivalCallPanelProps> = ({ sections, pendingId, onAction, titleExtras }) => (
  <div className="arrival-panel" role="dialog" aria-label={t("Reception:ArrivalCallOpen")}>
    {sections.map((section) => (
      <section key={section.action} className="arrival-panel-section">
        <h3 className="arrival-panel-title">
          {section.title}
          <span className="arrival-panel-count">{section.items.length}</span>
          {titleExtras?.[section.action] && (
            <span className="arrival-panel-title-extra">{titleExtras[section.action]}</span>
          )}
        </h3>
        <SectionBody section={section} pendingId={pendingId} onAction={onAction} />
      </section>
    ))}
  </div>
);
