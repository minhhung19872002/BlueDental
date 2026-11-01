import { Spin } from "antd";
import type { TaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import type { AdviseKind } from "./adviseTypes";

interface Props {
  kind: AdviseKind;
  singleCount: number;
  comboCount: number;
  groups: TaxonomyGroupOption[];
  activeGroupId: string | null;
  loading: boolean;
  /** A later page of groups is on its way. */
  hasMore: boolean;
  onKindChange: (kind: AdviseKind) => void;
  onGroupChange: (groupId: string | null) => void;
  onLoadMore: () => void;
}

/**
 * The left column of "Chọn dịch vụ" (P0111_02, R-1114): the "Dịch vụ lẻ |
 * Combo" switch, then — on Dịch vụ lẻ — the service groups as a list with
 * their counts, "Tất cả" first. It replaces the sideways chip strip.
 */
export function AdviseSideNav({
  kind,
  singleCount,
  comboCount,
  groups,
  activeGroupId,
  loading,
  hasMore,
  onKindChange,
  onGroupChange,
  onLoadMore,
}: Props) {
  const tabs: { kind: AdviseKind; label: string }[] = [
    { kind: "single", label: t("Treatment:Combo:TabSingle", singleCount) },
    { kind: "combo", label: t("Treatment:Combo:TabCombo", comboCount) },
  ];
  const allCount = groups.reduce((sum, group) => sum + group.itemCount, 0);

  return (
    <nav className="am-nav" aria-label={t("Treatment:Advise:Groups")}>
      <div className="am-kind-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={kind === tab.kind}
            className={kind === tab.kind ? "active" : undefined}
            onClick={() => onKindChange(tab.kind)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {kind === "single" && (
        <>
          <p className="am-nav-title">{t("Treatment:Advise:Groups")}</p>
          <div
            className="am-nav-list"
            onScroll={(event) => {
              const box = event.currentTarget;
              if (hasMore && box.scrollTop + box.clientHeight >= box.scrollHeight - 40) onLoadMore();
            }}
          >
            {loading && <Spin size="small" className="am-nav-spin" />}
            <NavItem label={t("Treatment:Advise:AllGroups")} count={allCount} active={activeGroupId === null} onClick={() => onGroupChange(null)} />
            {groups.map((group) => (
              <NavItem
                key={group.id}
                label={group.name}
                count={group.itemCount}
                active={activeGroupId === group.id}
                onClick={() => onGroupChange(group.id)}
              />
            ))}
            {hasMore && (
              <button type="button" className="am-nav-more" onClick={onLoadMore}>
                <Spin size="small" />
              </button>
            )}
          </div>
        </>
      )}
    </nav>
  );
}

interface NavItemProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function NavItem({ label, count, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      title={label}
      className={active ? "am-nav-item active" : "am-nav-item"}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="am-nav-name">{label}</span>
      <span className="am-nav-count">{count}</span>
    </button>
  );
}
