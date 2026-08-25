import { useState, type ReactNode } from "react";

export interface PillTabItem {
  key: string;
  label: ReactNode;
  /** Rendered under the switcher while this tab is active. */
  children?: ReactNode;
}

interface Props {
  items: PillTabItem[];
  /** Controlled key. Leave out to let the component hold its own. */
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  /** Sits at the far end of the switcher row, e.g. a count or an action. */
  extra?: ReactNode;
  className?: string;
}

/**
 * The design switches screens with pills, not an underline row, and never
 * draws Ant Design's tab bar. Screens whose panes live in `items.children`
 * use this rather than repeating the markup — the pane of the active key is
 * the only one mounted.
 */
export function PillTabs({
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  extra,
  className,
}: Props) {
  const [ownKey, setOwnKey] = useState(defaultActiveKey ?? items[0]?.key ?? "");
  const current = activeKey ?? ownKey;

  const handleSelect = (key: string) => {
    if (activeKey === undefined) setOwnKey(key);
    onChange?.(key);
  };

  const active = items.find((it) => it.key === current);

  return (
    <div className={className}>
      <div className="pill-tabs-row">
        <div className="pill-tabs" role="tablist">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="tab"
              aria-selected={it.key === current}
              className={`pill-tab${it.key === current ? " pill-tab--active" : ""}`}
              onClick={() => handleSelect(it.key)}
            >
              {it.label}
            </button>
          ))}
        </div>
        {extra}
      </div>
      {active?.children}
    </div>
  );
}
