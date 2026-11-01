import { Spin } from "antd";
import { t } from "@/lib/i18n";
import type { AdviseGroupNav, AdviseKind } from "./adviseTypes";

interface Props {
  kind: AdviseKind;
  singleCount: number;
  comboCount: number;
  /** The groups of the tab open, counted for its kind. */
  nav: AdviseGroupNav;
  onKindChange: (kind: AdviseKind) => void;
}

/**
 * The left column of "Chọn dịch vụ" (P0111_02, R-1114): the "Dịch vụ lẻ |
 * Combo" switch, then the service groups of the tab open as a list with
 * their counts, "Tất cả" first. It replaces the sideways chip strip. Combo
 * has its own list since R-1116 — the groups that hold a combo.
 */
export function AdviseSideNav({ kind, singleCount, comboCount, nav, onKindChange }: Props) {
  const tabs: { kind: AdviseKind; label: string }[] = [
    { kind: "single", label: t("Treatment:Combo:TabSingle", singleCount) },
    { kind: "combo", label: t("Treatment:Combo:TabCombo", comboCount) },
  ];

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

      <p className="am-nav-title">{t("Treatment:Advise:Groups")}</p>
      <div
        className="am-nav-list"
        onScroll={(event) => {
          // Down the column on wide screens, along one row of pills on narrow ones.
          const box = event.currentTarget;
          const atEnd =
            box.scrollTop + box.clientHeight >= box.scrollHeight - 40 &&
            box.scrollLeft + box.clientWidth >= box.scrollWidth - 40;
          if (nav.hasMore && atEnd) nav.onLoadMore();
        }}
      >
        {nav.loading && <Spin size="small" className="am-nav-spin" />}
        <NavItem label={t("Treatment:Advise:AllGroups")} count={nav.allCount} active={nav.activeId === null} onClick={() => nav.onChange(null)} />
        {nav.groups.map((group) => (
          <NavItem
            key={group.id}
            label={group.name}
            count={group.count}
            active={nav.activeId === group.id}
            onClick={() => nav.onChange(group.id)}
          />
        ))}
        {nav.hasMore && (
          <button type="button" className="am-nav-more" onClick={nav.onLoadMore}>
            <Spin size="small" />
          </button>
        )}
      </div>
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
