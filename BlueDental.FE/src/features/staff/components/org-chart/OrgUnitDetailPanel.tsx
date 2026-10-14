import type { Ref } from "react";
import { Button, Tooltip } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type OrgStaffDto, type OrgUnitDto } from "../../api/orgChartApi";
import { OrgAvatar } from "./OrgAvatar";
import { OrgPersonRow } from "./OrgPersonRow";
import { OrgScopeRows } from "./OrgScopeRows";
import { headOf, ORG_KIND_CONFIG, sizeLine, sizeOf, type OrgChartIndex } from "./orgChartModel";

interface Props {
  ref?: Ref<HTMLElement>;
  index: OrgChartIndex;
  unit: OrgUnitDto;
  /** Absent when the account may not change the chart. */
  actions?: {
    onEdit: (unit: OrgUnitDto) => void;
    onAddMembers: (unitId: string) => void;
    onChangeRootHead: () => void;
    /** × on a member row: removes them straight from the panel, after a confirm. */
    onRemoveMember: (unit: OrgUnitDto, person: OrgStaffDto) => void;
  };
  onSelect: (unitId: string) => void;
}

function unitLabel(unit: OrgUnitDto): string {
  return unit.kind === ORG_UNIT_KIND.Root ? t("OrgChart:Kind:Root") : unit.name;
}

/** "Báo cáo cho": the parent's head and the parent, or the tree-root note. */
function reportsTo(parent: OrgUnitDto | undefined): string {
  if (!parent) return t("OrgChart:Detail:TreeRoot");
  const head = headOf(parent);
  return head
    ? t("OrgChart:Detail:ReportsToValue", head.name, unitLabel(parent))
    : unitLabel(parent);
}

/**
 * The right panel, led by the head as on the BA mock: who they are and what
 * they head, whom they report to, the size, the scope box and the direct
 * reports, then the unit's members.
 */
export function OrgUnitDetailPanel({ ref, index, unit, actions, onSelect }: Props) {
  const isRoot = unit.kind === ORG_UNIT_KIND.Root;
  const head = headOf(unit);
  const parent = unit.parentId ? index.byId.get(unit.parentId) : undefined;
  const children = index.childrenOf(unit.id);
  const kind = ORG_KIND_CONFIG[unit.kind];
  // The head already leads the panel; a Phòng ban or the root lists members only when someone else sits there.
  const showMembers =
    unit.kind === ORG_UNIT_KIND.DoctorTeam || unit.members.some((m) => m.id !== unit.headStaffId);

  return (
    <aside ref={ref} className="page-card org-detail" aria-label={t("OrgChart:Detail:Title")}>
      <div className="org-detail__body">
        <header className="org-detail__head">
          {head ? (
            <OrgAvatar name={head.name} tone={kind.modifier} size="lg" />
          ) : (
            <span
              className="org-initials org-initials--empty org-initials--lg"
              aria-hidden="true"
            />
          )}
          <div className="org-detail__who">
            <h2 className="org-detail__name">{head ? head.name : t("OrgChart:Node:NoHead")}</h2>
            <span className="org-detail__sub">
              {t(kind.roleKey)} · <span className="org-detail__unit">{unit.name}</span>
            </span>
          </div>
        </header>

        <dl className="org-facts">
          <div>
            <dt>{t("OrgChart:Detail:ReportsTo")}</dt>
            <dd>{reportsTo(parent)}</dd>
          </div>
          <div>
            <dt>{t("OrgChart:Detail:Size")}</dt>
            <dd>{sizeLine(unit, sizeOf(index, unit))}</dd>
          </div>
        </dl>

        <OrgScopeRows kind={unit.kind} />

        {unit.kind !== ORG_UNIT_KIND.DoctorTeam && (
          <section className="org-detail__section">
            <h3>{t("OrgChart:Detail:Children", children.length)}</h3>
            {children.length === 0 && (
              <p className="org-muted">{t("OrgChart:Detail:NoChildren")}</p>
            )}
            {children.map((child) => {
              const childHead = headOf(child);
              return (
                <button
                  key={child.id}
                  type="button"
                  className="org-child"
                  onClick={() => onSelect(child.id)}
                >
                  <OrgAvatar name={childHead?.name ?? child.name} size="sm" />
                  <span className="org-child__name">
                    {childHead?.name ?? t("OrgChart:Node:NoHead")}
                  </span>
                  <span className="org-child__unit">{child.name}</span>
                </button>
              );
            })}
          </section>
        )}

        {showMembers && (
          <section className="org-detail__section org-detail__members">
            <h3>{t("OrgChart:Detail:Members", unit.members.length)}</h3>
            {unit.members.map((m) => {
              const isHead = m.id === unit.headStaffId;
              // The head leaves only through a head change, so they get no ×.
              const onRemove = isHead ? undefined : actions?.onRemoveMember;
              return (
                <OrgPersonRow
                  key={m.id}
                  person={m}
                  isHead={isHead}
                  action={
                    onRemove && (
                      <Tooltip title={t("OrgChart:Action:MemberRemoved")}>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<CloseOutlined />}
                          aria-label={t("OrgChart:Members:Remove", m.name)}
                          onClick={() => onRemove(unit, m)}
                        />
                      </Tooltip>
                    )
                  }
                />
              );
            })}
          </section>
        )}
      </div>

      {actions && (
        <footer className="org-detail__actions">
          {isRoot ? (
            <Button onClick={actions.onChangeRootHead}>
              {t("OrgChart:Action:ChangeRootHead")}
            </Button>
          ) : (
            <Button onClick={() => actions.onEdit(unit)}>{t("OrgChart:Action:Edit")}</Button>
          )}
          {/* The root too: the Tổng giám đốc may run a team of their own (BA 2026-10-13). */}
          <Button onClick={() => actions.onAddMembers(unit.id)}>
            {t("OrgChart:Action:AddMembers")}
          </Button>
        </footer>
      )}
    </aside>
  );
}
