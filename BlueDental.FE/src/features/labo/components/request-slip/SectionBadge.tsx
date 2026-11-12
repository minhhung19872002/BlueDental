interface Props {
  tone: "miss" | "ok" | "opt";
  children: string;
}

/** The pill at the end of a section heading: Chưa chọn / 3 răng / Không bắt buộc. */
export function SectionBadge({ tone, children }: Props) {
  return <span className={`rs-badge rs-badge--${tone}`}>{children}</span>;
}
