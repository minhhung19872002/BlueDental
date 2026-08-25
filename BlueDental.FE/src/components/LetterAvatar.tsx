import { cn } from "@/lib/cn";

/**
 * Eight-slot palette indexed by the first letter of the name, so the same
 * record always keeps the same colour without storing one.
 *
 * The reference application colours these squares the same way; the four slots
 * confirmed by observation are marked, the rest are our own choice and are
 * recorded in docs/clone/unknowns.md.
 */
const PALETTE = [
  "#8B5CF6", // 0 — assumption
  "#3B82F6", // 1 — observed (A, I)
  "#06B6D4", // 2 — assumption
  "#F59E0B", // 3 — observed (S)
  "#F43F5E", // 4 — observed (T)
  "#10B981", // 5 — observed (M)
  "#6366F1", // 6 — assumption
  "#EC4899", // 7 — assumption
] as const;

function firstLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function letterAvatarColor(name: string): string {
  const letter = firstLetter(name);
  if (!letter) return PALETTE[0];
  return PALETTE[letter.charCodeAt(0) % PALETTE.length];
}

interface Props {
  name: string;
  className?: string;
}

/**
 * Rounded initial square shown in front of a record name.
 *
 * Purely decorative — the name it stands for is always rendered next to it, so
 * it stays out of the accessibility tree.
 */
export function LetterAvatar({ name, className }: Props) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: letterAvatarColor(name) }}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white",
        className,
      )}
    >
      {firstLetter(name)}
    </span>
  );
}
