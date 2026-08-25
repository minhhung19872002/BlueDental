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
    <div className={cn("shrink-0 border-b border-app-line bg-white px-5", className)}>
      <nav aria-label={label} className="flex overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;

          return (
            <NavLink
              key={tab.key}
              to={tab.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative shrink-0 px-4 py-3.5 text-[14px] font-semibold whitespace-nowrap",
                "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-app-primary/40 focus-visible:ring-inset",
                active
                  ? "bg-app-primary-soft text-app-primary"
                  : "text-slate-600 hover:bg-app-surface hover:text-app-ink",
              )}
            >
              {tab.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-app-primary" />
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
