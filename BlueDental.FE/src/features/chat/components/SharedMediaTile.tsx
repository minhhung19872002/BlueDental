import React from "react";
import { Image, Spin } from "antd";
import { Check } from "lucide-react";
import { useChatAttachmentBlob } from "../api/chatQueries";
import { useInView } from "../hooks/useInView";
import { useObjectUrl } from "../hooks/useObjectUrl";
import type { ChatSharedFileDto } from "../types";
import { displayFileName } from "../utils/chatFormat";
import type { SharedPicking } from "../utils/chatShared";
import { SharedJumpButton } from "./SharedJumpButton";

interface SharedMediaTileProps {
  file: ChatSharedFileDto;
  picking: SharedPicking;
  onJump: (messageId: string) => void;
}

/**
 * A square thumbnail of a picture sent in the conversation. Its bytes are
 * fetched (and decrypted by the server) only once it scrolls near the screen.
 * Click enlarges it; while choosing, click ticks it.
 */
export const SharedMediaTile = React.memo(function SharedMediaTile({ file, picking, onJump }: SharedMediaTileProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { attachment } = file;
  const { data } = useChatAttachmentBlob(file.messageId, attachment.id, inView);
  const url = useObjectUrl(data);
  const name = displayFileName(attachment.fileName);
  const selected = picking.selected.has(attachment.id);
  const className = ["chat-shared-tile", selected && "chat-shared-tile--selected"].filter(Boolean).join(" ");

  const picture = url ? <img src={url} alt={name} /> : <Spin size="small" />;

  return (
    <div ref={ref} className={className}>
      {picking.selecting ? (
        <button
          type="button"
          className="chat-shared-tile-pick"
          aria-label={name}
          aria-pressed={selected}
          onClick={() => picking.toggle(attachment.id, { kind: "file", item: file })}
        >
          {picture}
          <span className="chat-shared-tile-check" aria-hidden>
            {selected && <Check size={14} />}
          </span>
        </button>
      ) : (
        <>
          {url ? <Image src={url} alt={name} rootClassName="chat-shared-tile-image" /> : picture}
          <SharedJumpButton onClick={() => onJump(file.messageId)} />
        </>
      )}
    </div>
  );
});
