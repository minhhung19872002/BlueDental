import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { TOOTH_PICKER_TABS, type ToothPickerTab } from "./toothPicker";

interface Props {
  value: ToothPickerTab;
  onChange: (tab: ToothPickerTab) => void;
}

interface Indicator {
  x: number;
  width: number;
}

/**
 * The bordered tab strip at the top of "Chọn răng". The blue pill is one
 * element that slides under the active tab, the way the reference animates
 * it, so its position is measured from the active button.
 */
export function ToothPickerTabs({ value, onChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<Indicator>({ x: 0, width: 0 });

  useLayoutEffect(() => {
    const active = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (!active) return;
    setIndicator({ x: active.offsetLeft, width: active.offsetWidth });
  }, [value]);

  const style = { "--tp-tab-x": `${indicator.x}px`, "--tp-tab-w": `${indicator.width}px` } as CSSProperties;

  return (
    <div className="tp-teeth-tabs-scroll">
      <div ref={listRef} className="tp-teeth-tabs" role="tablist" style={style}>
        <span className="tp-teeth-tabs__pill" aria-hidden="true" />
        {TOOTH_PICKER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={value === tab.key}
            className={value === tab.key ? "active" : undefined}
            onClick={() => onChange(tab.key)}
          >
            {tab.label()}
          </button>
        ))}
      </div>
    </div>
  );
}
