import type { CSSProperties } from "react";
import type { TicketTagDto } from "../api/ticketSupportApi";

interface Props {
  tagIds: string[];
  tags: Map<string, TicketTagDto>;
}

/** A ticket's Thẻ, each in its own colour. A tag deleted since is simply not shown. */
export function TicketTagChips({ tagIds, tags }: Props) {
  const known = tagIds.flatMap((id) => tags.get(id) ?? []);
  if (known.length === 0) return <span className="bd-cat-num">—</span>;

  return (
    <span className="mkt-tags">
      {known.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
    </span>
  );
}

export function TagChip({ tag }: { tag: Pick<TicketTagDto, "name" | "color"> }) {
  // The one dynamic value — the tag's own colour — goes in as a custom property.
  const style = { "--mkt-tag-color": tag.color } as CSSProperties;
  return (
    <span className="mkt-tag" style={style}>
      {tag.name}
    </span>
  );
}
