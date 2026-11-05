export interface LaboToggleItem<K extends string> {
  key: K;
  label: string;
}

interface Props<K extends string> {
  /** Names the group for a screen reader. */
  label: string;
  items: readonly LaboToggleItem<K>[];
  value: K;
  disabled?: boolean;
  size?: "md" | "sm";
  onChange: (key: K) => void;
}

/** The small grey Chung / Riêng switch of the Labo v2 mock: the picked button white, in indigo. */
export function LaboToggle<K extends string>({ label, items, value, disabled, size = "md", onChange }: Props<K>) {
  return (
    <div className={`pd-lts-toggle pd-lts-toggle--${size}`} role="group" aria-label={label}>
      {items.map((item) => {
        const pressed = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            className={pressed ? "pd-lts-toggle-item pd-lts-toggle-item--on" : "pd-lts-toggle-item"}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => !pressed && onChange(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
