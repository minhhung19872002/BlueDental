import type { OrgKindModifier } from "./orgChartModel";

/** Honorifics such as "BS." or "ThS." are not part of the initials ("BS. Lê Thu Hà" → "LH"). */
const TITLE = /^\p{L}{1,4}\.$/u;

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w && !TITLE.test(w));
  if (words.length === 0) return "?";
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return (words[0].charAt(0) + last).toLocaleUpperCase("vi");
}

interface Props {
  name: string;
  /** The kind the person heads; "plain" for members. */
  tone?: OrgKindModifier | "plain";
  size?: "sm" | "md" | "lg";
}

/** Round initials as on the BA mock: filled for the chief, tinted for heads, grey for members. */
export function OrgAvatar({ name, tone = "plain", size = "md" }: Props) {
  return (
    <span aria-hidden="true" className={`org-initials org-initials--${tone} org-initials--${size}`}>
      {initialsOf(name)}
    </span>
  );
}
