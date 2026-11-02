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
}

const SectionBody: React.FC<{ section: ArrivalCallSection } & Omit<ArrivalCallPanelProps, "sections">> = ({
  section,
  pendingId,
  onAction,
}) => {
  if (section.loading) {
    return (
      <div className="arrival-panel-empty">
        <Spin />
      </div>
    );
  }
  if (section.items.length === 0) {
    return <div className="arrival-panel-empty">{t("Reception:ArrivalCallEmpty")}</div>;
  }
  return (
    <ul className="arrival-panel-list">
      {section.items.map((item) => (
        <ArrivalCallRow
          key={item.id}
          item={item}
          action={section.action}
          canAct={section.canAct}
          pending={pendingId === item.id}
          onAction={onAction}
        />
      ))}
    </ul>
  );
};

export const ArrivalCallPanel: React.FC<ArrivalCallPanelProps> = ({ sections, pendingId, onAction }) => (
  <div className="arrival-panel" role="dialog" aria-label={t("Reception:ArrivalCallOpen")}>
    {sections.map((section) => (
      <section key={section.action} className="arrival-panel-section">
        <h3 className="arrival-panel-title">
          {section.title}
          <span className="arrival-panel-count">{section.items.length}</span>
        </h3>
        <SectionBody section={section} pendingId={pendingId} onAction={onAction} />
      </section>
    ))}
  </div>
);
