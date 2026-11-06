import React from "react";
import { FileText } from "lucide-react";
import { downloadBlob } from "@/utils/download";
import { useDownloadChatAttachment } from "../api/chatMutations";
import type { ChatSharedFileDto } from "../types";
import { displayFileName, formatFileSize, formatMessageTime } from "../utils/chatFormat";
import type { SharedPicking } from "../utils/chatShared";
import { SharedRow } from "./SharedRow";

interface SharedFileRowProps {
  file: ChatSharedFileDto;
  picking: SharedPicking;
  onJump: (messageId: string) => void;
}

/** A document of Kho lưu trữ: click downloads it, the way its chip in the thread does. */
export const SharedFileRow = React.memo(function SharedFileRow({ file, picking, onJump }: SharedFileRowProps) {
  const download = useDownloadChatAttachment();
  const { attachment } = file;
  const name = displayFileName(attachment.fileName);

  const handleDownload = () => {
    download.mutate(
      { messageId: file.messageId, attachmentId: attachment.id },
      { onSuccess: (blob) => downloadBlob(blob, name) },
    );
  };

  return (
    <SharedRow
      selecting={picking.selecting}
      selected={picking.selected.has(attachment.id)}
      onToggle={() => picking.toggle(attachment.id, { kind: "file", item: file })}
      onJump={() => onJump(file.messageId)}
      open={{ onClick: handleDownload, busy: download.isPending }}
    >
      <FileText size={22} className="chat-shared-row-icon" aria-hidden />
      <span className="chat-shared-row-text">
        <span className="chat-shared-row-title">{name}</span>
        <span className="chat-shared-row-meta">
          {formatFileSize(attachment.sizeInBytes)} · {file.senderName} · {formatMessageTime(file.sentAt)}
        </span>
      </span>
    </SharedRow>
  );
});
