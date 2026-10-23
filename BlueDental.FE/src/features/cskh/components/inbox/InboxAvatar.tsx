import type { CSSProperties } from "react";
import { letterAvatarColor } from "@/components/LetterAvatar";
import { initials } from "../../inboxLook";

interface Props {
  name: string;
  avatarUrl: string | null;
  size?: "md" | "lg";
}

/** Zalo's avatar when the user has one, else their initials on a colour kept per name. Decorative: the name is beside it. */
export function InboxAvatar({ name, avatarUrl, size = "md" }: Props) {
  const className = `ibx-avatar ibx-avatar--${size}`;
  if (avatarUrl) {
    return <img className={className} src={avatarUrl} alt="" aria-hidden="true" referrerPolicy="no-referrer" />;
  }

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ "--ibx-avatar-color": letterAvatarColor(name) } as CSSProperties}
    >
      {initials(name)}
    </span>
  );
}
