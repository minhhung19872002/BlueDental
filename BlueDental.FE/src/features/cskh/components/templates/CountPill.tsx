/** A segmented-tab label with its count: "Zalo 4", "Khách hàng 6". */
export function CountPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="tpl-channel-pill">
      {label} <span className="tpl-channel-pill-count">{count}</span>
    </span>
  );
}
