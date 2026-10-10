import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type OrgUnitDto } from "../../api/orgChartApi";
import { OrgAvatar } from "./OrgAvatar";
import { headOf, ORG_KIND_CONFIG, sizeLine, type OrgUnitSize } from "./orgChartModel";

const VISIBLE_FACES = 4;

/** Node-level "Thấy: …" — what the head of this kind sees on the schedule screens. */
const NODE_SCOPE_KEY: Record<OrgUnitDto["kind"], string> = {
  [ORG_UNIT_KIND.Root]: "OrgChart:NodeScope:Root",
  [ORG_UNIT_KIND.Department]: "OrgChart:NodeScope:Department",
  [ORG_UNIT_KIND.DoctorTeam]: "OrgChart:NodeScope:Team",
};

interface Props {
  unit: OrgUnitDto;
  size: OrgUnitSize;
  selected: boolean;
  /** Search state: matched, dimmed (searching but not matched), or neither. */
  highlight: "match" | "dim" | null;
  onSelect: (unitId: string) => void;
}

/**
 * One box of the tree, built around its head as on the BA mock: the unit name
 * on top (none for the chief), the head with their title, then the head-count
 * with the "Thấy: …" pill — or, for a team, its faces.
 */
export function OrgUnitNode({ unit, size, selected, highlight, onSelect }: Props) {
  const head = headOf(unit);
  const kind = ORG_KIND_CONFIG[unit.kind];
  const isTeam = unit.kind === ORG_UNIT_KIND.DoctorTeam;
  const className = [
    "org-node",
    `org-node--${kind.modifier}`,
    selected && "org-node--selected",
    highlight && `org-node--${highlight}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" className={className} aria-pressed={selected} onClick={() => onSelect(unit.id)}>
      {unit.kind !== ORG_UNIT_KIND.Root && <span className="org-node__label">{unit.name}</span>}

      <span className="org-node__head">
        {head ? (
          <OrgAvatar name={head.name} tone={kind.modifier} size="lg" />
        ) : (
          <span className="org-initials org-initials--empty org-initials--lg" aria-hidden="true" />
        )}
        <span className="org-node__who">
          <span className={head ? "org-node__head-name" : "org-node__head-empty"}>
            {head ? head.name : t("OrgChart:Node:NoHead")}
          </span>
          <span className="org-node__role">{t(kind.roleKey)}</span>
        </span>
      </span>

      <span className="org-node__foot">
        {isTeam ? (
          <span className="org-node__faces" aria-label={t("OrgChart:Node:Members", unit.members.length)}>
            {unit.members.slice(0, VISIBLE_FACES).map((m) => (
              <OrgAvatar key={m.id} name={m.name} size="sm" />
            ))}
            {unit.members.length > VISIBLE_FACES && (
              <span className="org-node__more">+{unit.members.length - VISIBLE_FACES}</span>
            )}
          </span>
        ) : (
          <span className="org-node__size">{sizeLine(unit, size)}</span>
        )}
        {isTeam ? (
          <span className="org-node__size">{sizeLine(unit, size)}</span>
        ) : (
          <span className="org-node__scope">{t(NODE_SCOPE_KEY[unit.kind])}</span>
        )}
      </span>
    </button>
  );
}
