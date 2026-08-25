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
 * Full-width underline tab strip sitting directly under the application header.
 *
 * Tabs are links, not buttons: every sub-screen has its own URL so it can be
 * bookmarked, shared and reached by the browser's back button.
 */
export function PageTabBar({ tabs, activeKey, label, className }: Props) {
  return (
    <div className={cn("bd-tabbar", className)}>
      <nav aria-label={label} className="bd-tabbar-nav">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;

          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={cn("bd-tab", active && "bd-tab--active")}
            >
              {tab.label}
              {active && <span className="bd-tab-underline" aria-hidden="true" />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
