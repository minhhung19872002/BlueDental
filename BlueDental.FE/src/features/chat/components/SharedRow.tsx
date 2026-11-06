import React, { type ReactNode } from "react";
import { Checkbox, Spin } from "antd";
import { SharedJumpButton } from "./SharedJumpButton";

type SharedRowOpen = { href: string } | { onClick: () => void; busy: boolean };

interface SharedRowProps {
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onJump: () => void;
  /** A link opens in a new tab; a file downloads. */
  open: SharedRowOpen;
  children: ReactNode;
}

/** One file or link of Kho lưu trữ: opens it, or ticks it while choosing. */
export const SharedRow: React.FC<SharedRowProps> = ({ selecting, selected, onToggle, onJump, open, children }) => {
  const className = ["chat-shared-row", selected && "chat-shared-row--selected"].filter(Boolean).join(" ");
  if (selecting) {
    return (
      <li className={className}>
        <Checkbox className="chat-shared-row-main" checked={selected} onChange={onToggle}>
          {children}
        </Checkbox>
      </li>
    );
  }

  return (
    <li className={className}>
      {"href" in open ? (
        <a className="chat-shared-row-main" href={open.href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ) : (
        <button type="button" className="chat-shared-row-main" disabled={open.busy} onClick={open.onClick}>
          {children}
          {open.busy && <Spin size="small" />}
        </button>
      )}
      <SharedJumpButton onClick={onJump} />
    </li>
  );
};
