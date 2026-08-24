interface Props {
  label: string;
  bg: string;
  color: string;
}

export function StatusBadge({ label, bg, color }: Props) {
  return (
    <span
      className="inline-block rounded-xl px-2.5 py-0.5 text-xs font-medium leading-5"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}
