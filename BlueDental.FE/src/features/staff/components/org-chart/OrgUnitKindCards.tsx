import { ApartmentOutlined, TeamOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type CreatableOrgUnitKind } from "../../api/orgChartApi";

const KIND_CARDS: { kind: CreatableOrgUnitKind; icon: ReactNode; titleKey: string; hintKey: string }[] = [
  { kind: ORG_UNIT_KIND.Department, icon: <ApartmentOutlined />, titleKey: "OrgChart:Kind:Department", hintKey: "OrgChart:KindHint:Department" },
  { kind: ORG_UNIT_KIND.DoctorTeam, icon: <TeamOutlined />, titleKey: "OrgChart:Kind:DoctorTeam", hintKey: "OrgChart:KindHint:DoctorTeam" },
];

interface Props {
  value?: CreatableOrgUnitKind;
  onChange?: (value: CreatableOrgUnitKind) => void;
}

/** "Loại đơn vị" as two radio cards, each saying where that kind may sit. */
export function OrgUnitKindCards({ value, onChange }: Props) {
  return (
    <div className="org-kind-cards" role="radiogroup" aria-label={t("OrgChart:Field:kind")}>
      {KIND_CARDS.map((card) => (
        <button
          key={card.kind}
          type="button"
          role="radio"
          aria-checked={value === card.kind}
          className={["org-kind-card", value === card.kind && "org-kind-card--active"].filter(Boolean).join(" ")}
          onClick={() => onChange?.(card.kind)}
        >
          <span className="org-kind-card__icon">{card.icon}</span>
          <span className="org-kind-card__text">
            <strong>{t(card.titleKey)}</strong>
            <span>{t(card.hintKey)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
