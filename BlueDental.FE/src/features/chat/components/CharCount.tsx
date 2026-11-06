import React from "react";
import { t } from "@/lib/i18n";
import { CHAT_LIMITS } from "../types";

/** Shown once fewer than this many characters are left. */
const SHOW_WHEN_LEFT = 400;

interface CharCountProps {
  length: number;
}

/** "3.850/4.000" under the limit's last stretch, red when it is reached (R-1162 I6.1). */
export const CharCount: React.FC<CharCountProps> = ({ length }) => {
  const max = CHAT_LIMITS.maxMessageLength;
  const left = max - length;
  if (left > SHOW_WHEN_LEFT) return null;
  const className = ["chat-char-count", left <= 0 && "chat-char-count--full"].filter(Boolean).join(" ");
  const label = t("Chat:CharsLeft", Math.max(left, 0));
  return (
    <span className={className} title={label} aria-label={label}>
      {`${length.toLocaleString("vi-VN")}/${max.toLocaleString("vi-VN")}`}
    </span>
  );
};
