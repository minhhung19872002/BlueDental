import React from "react";
import { Spin, Tag } from "antd";
import { X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PendingChatFile } from "../hooks/useChatComposer";
import { displayFileName } from "../utils/chatFormat";

interface PendingFileChipProps {
  file: PendingChatFile;
  onRemove: (key: string) => void;
}

/**
 * A file picked for the next message. While it uploads the chip fills up and
 * shows how much has gone; at 100% the server is still checking and sealing
 * it, so it says so until the upload is stored.
 */
export const PendingFileChip: React.FC<PendingFileChipProps> = ({ file, onRemove }) => {
  const name = displayFileName(file.name);
  if (file.attachmentId) {
    return (
      <Tag
        closable
        closeIcon={<X size={12} aria-label={t("Chat:RemoveAttachment", name)} />}
        onClose={() => onRemove(file.key)}
      >
        <span className="chat-file-name">{name}</span>
      </Tag>
    );
  }

  const label = file.progress < 100 ? `${file.progress}%` : t("Chat:Processing");
  // Spinner as a child, not Tag's `icon`: with an icon AntD wraps the children
  // in one span, the name stops being a flex item and its ellipsis is lost.
  return (
    <Tag
      className="chat-upload-chip"
      style={{ "--chat-upload-progress": `${file.progress}%` } as React.CSSProperties}
      role="progressbar"
      aria-label={t("Chat:Uploading", name)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={file.progress}
    >
      <Spin size="small" />
      <span className="chat-file-name">{name}</span>
      <span className="chat-upload-percent">{label}</span>
    </Tag>
  );
};
