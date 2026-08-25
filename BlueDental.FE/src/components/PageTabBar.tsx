import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";

export interface PageTab {
  /** Stable key, also used as the route slug by most callers. */
  key: string;
  label: string;
  to: string;
}

interface Props {
  tabs: PageTab[];
  activeKey: string;
  /** Announced to screen readers, e.g. "Danh mục". */
  label: string;
  className?: string;
}

/**
 * Pill switcher for a screen whose panes are separate routes.
 *
 * It wears the same pills as {@link PillTabs} — the design switches screens
 * with pills, not an underline row — but each pill is a real link, because
 * every sub-screen here has its own URL: bookmarkable, shareable, reachable
 * with the back button, and openable in a new tab. PillTabs holds its panes in
 * memory instead, so it cannot do that.
 */
export function PageTabBar({ tabs, activeKey, label, className }: Props) {
  return (
    <div className={cn("bd-tabbar", className)}>
      <nav aria-label={label} className="pill-tabs">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;

          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={cn("pill-tab", active && "pill-tab--active")}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
