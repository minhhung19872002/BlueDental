import React from "react";
import { splitPatientTags } from "../utils/chatPatientTokens";

interface MessageTextProps {
  text: string;
  className: string;
}

/**
 * A message's words with each # tag shown as `#Tên` (R-1161). Everything is
 * rendered as text — React escapes it — never as HTML.
 */
export const MessageText: React.FC<MessageTextProps> = ({ text, className }) => (
  <p className={className}>
    {splitPatientTags(text).map((segment, index) =>
      segment.kind === "patient" ? (
        <span key={index} className="chat-tag">
          #{segment.name}
        </span>
      ) : (
        <React.Fragment key={index}>{segment.text}</React.Fragment>
      ),
    )}
  </p>
);
