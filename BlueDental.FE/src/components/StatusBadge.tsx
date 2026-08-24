// StatusBadge — generic colored status pill for any entity.

import { Tag } from "antd";

interface Props {
  label: string;
  bg: string;
  color: string;
}

export function StatusBadge({ label, bg, color }: Props) {
  return (
    <Tag style={{ background: bg, color, border: "none" }}>{label}</Tag>
  );
}
