import React from "react";
import { Spin, Tag } from "antd";
import { RotateCw, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PendingChatFile } from "../hooks/useChatComposer";
import { displayFileName } from "../utils/chatFormat";

interface PendingFileChipProps {
  file: PendingChatFile;
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
}

interface ChipButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

const ChipButton: React.FC<ChipButtonProps> = ({ label, onClick, children }) => (
  <button type="button" className="chat-chip-button" aria-label={label} title={label} onClick={onClick}>
    {children}
  </button>
);

/**
 * A file picked for the next message. While it uploads the chip fills up and
 * shows how much has gone (× stops it); at 100% the server is still checking
 * and sealing it. A failed upload stays, to try again or drop (R-1162).
 */
export const PendingFileChip: React.FC<PendingFileChipProps> = ({ file, onRemove, onRetry }) => {
  const name = displayFileName(file.name);
  const handleRemove = () => onRemove(file.key);

  if (file.attachmentId) {
    return (
      <Tag
        closable
        closeIcon={<X size={12} aria-label={t("Chat:RemoveAttachment", name)} />}
        onClose={handleRemove}
      >
        <span className="chat-file-name">{name}</span>
      </Tag>
    );
  }

  if (file.failed) {
    return (
      <Tag className="chat-upload-chip chat-upload-chip--failed">
        <span className="chat-file-name">{name}</span>
        <span className="chat-upload-percent">{t("Chat:UploadFailed")}</span>
        <ChipButton label={t("Chat:RetryUpload", name)} onClick={() => onRetry(file.key)}>
          <RotateCw size={12} aria-hidden />
        </ChipButton>
        <ChipButton label={t("Chat:RemoveAttachment", name)} onClick={handleRemove}>
          <X size={12} aria-hidden />
        </ChipButton>
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
    >
      <span
        className="chat-upload-status"
        role="progressbar"
        aria-label={t("Chat:Uploading", name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={file.progress}
      >
        <Spin size="small" />
        <span className="chat-file-name">{name}</span>
        <span className="chat-upload-percent">{label}</span>
      </span>
      <ChipButton label={t("Chat:CancelUpload", name)} onClick={handleRemove}>
        <X size={12} aria-hidden />
      </ChipButton>
    </Tag>
  );
};
