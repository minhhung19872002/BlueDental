import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./SegmentedTabs.css";

export interface SegmentedTabItem<K extends string = string> {
  key: K;
  label: ReactNode;
}

interface SegmentedTabsProps<K extends string> {
  items: readonly SegmentedTabItem<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  className?: string;
}

/**
 * Bordered segmented control, 40px tall: a navy thumb slides under the active
 * item, inactive items get a light tint on hover, and the row scrolls
 * horizontally when it overflows. Used for date modes, care-type tabs, and
 * any other single-choice switcher that is not a screen-level pill tab.
 */
export function SegmentedTabs<K extends string>({
  items,
  activeKey,
  onChange,
  className,
}: SegmentedTabsProps<K>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, w: 0 });

  const measureThumb = useCallback(() => {
    const container = containerRef.current;
    const active = container?.querySelector<HTMLElement>(".seg-tabs-item--active");
    if (!active || !container) return;
    setThumb((prev) =>
      prev.x === active.offsetLeft && prev.w === active.offsetWidth
        ? prev
        : { x: active.offsetLeft, w: active.offsetWidth },
    );
    if (container.scrollWidth > container.clientWidth) {
      active.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, []);

  // Re-measure before every paint (active/labels changed) and on resize.
  useLayoutEffect(measureThumb);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(measureThumb);
    observer.observe(container);
    return () => observer.disconnect();
  }, [measureThumb]);

  return (
    <div
      ref={containerRef}
      className={["seg-tabs", className].filter(Boolean).join(" ")}
      style={{ "--seg-thumb-x": `${thumb.x}px`, "--seg-thumb-w": `${thumb.w}px` } as CSSProperties}
    >
      <span className="seg-tabs-thumb" aria-hidden="true" />
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={item.key === activeKey}
          className={["seg-tabs-item", item.key === activeKey && "seg-tabs-item--active"]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
