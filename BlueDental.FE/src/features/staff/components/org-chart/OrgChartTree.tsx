import type { ReactNode } from "react";
import { Spin } from "antd";
import { EmptyState } from "@/components/EmptyState";
import { t } from "@/lib/i18n";
import { ORG_UNIT_KIND, type OrgUnitDto } from "../../api/orgChartApi";
import { OrgUnitNode } from "./OrgUnitNode";
import { ORG_KIND_CONFIG, sizeOf, unitMatches, type OrgChartIndex } from "./orgChartModel";

const LEGEND = [ORG_UNIT_KIND.Root, ORG_UNIT_KIND.Department, ORG_UNIT_KIND.DoctorTeam] as const;

interface Props {
  index: OrgChartIndex;
  loading: boolean;
  selectedId: string | null;
  /** The normalised search text; empty when not searching. */
  needle: string;
  onSelect: (unitId: string) => void;
  /** Shown under the chart — the "Chưa thuộc đơn vị nào" strip. */
  children?: ReactNode;
}

interface BranchProps extends Omit<Props, "loading" | "children"> {
  unit: OrgUnitDto;
}

/** One unit and, below it, its children joined by the connector lines. */
function OrgTreeBranch({ unit, index, selectedId, needle, onSelect }: BranchProps) {
  const children = index.childrenOf(unit.id);
  const highlight = needle ? (unitMatches(unit, needle) ? "match" : "dim") : null;

  return (
    <li className="org-tree__item">
      <OrgUnitNode
        unit={unit}
        size={sizeOf(index, unit)}
        selected={unit.id === selectedId}
        highlight={highlight}
        onSelect={onSelect}
      />
      {children.length > 0 && (
        <ul className="org-tree__children">
          {children.map((child) => (
            <OrgTreeBranch
              key={child.id}
              unit={child}
              index={index}
              selectedId={selectedId}
              needle={needle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** "Cây tổ chức": legend on top, the chart below, scrolling sideways when it outgrows the card. */
export function OrgChartTree({ index, loading, selectedId, needle, onSelect, children }: Props) {
  const searchMisses = Boolean(needle) && !index.units.some((u) => unitMatches(u, needle));

  return (
    <section className="page-card org-tree-card" aria-label={t("OrgChart:Tree:Title")}>
      <header className="org-tree-card__head">
        <h2 className="org-tree-card__title">{t("OrgChart:Tree:Title")}</h2>
        <ul className="org-legend">
          {LEGEND.map((kind) => (
            <li key={kind} className={`org-legend__item org-legend__item--${ORG_KIND_CONFIG[kind].modifier}`}>
              {t(ORG_KIND_CONFIG[kind].roleKey)}
            </li>
          ))}
        </ul>
      </header>

      {searchMisses && <p className="org-tree-card__miss">{t("OrgChart:Search:NoMatch")}</p>}

      <Spin spinning={loading}>
        <div className="org-tree-card__scroll">
          {index.root ? (
            <ul className="org-tree">
              <OrgTreeBranch
                unit={index.root}
                index={index}
                selectedId={selectedId}
                needle={needle}
                onSelect={onSelect}
              />
            </ul>
          ) : (
            !loading && <EmptyState title={t("OrgChart:Tree:Empty")} />
          )}
        </div>
      </Spin>
      {children}
    </section>
  );
}
