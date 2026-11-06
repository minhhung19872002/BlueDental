import React, { useEffect, useMemo } from "react";
import { Image, Spin } from "antd";
import { Download, FileText } from "lucide-react";
import { t } from "@/lib/i18n";
import { downloadBlob } from "@/utils/download";
import { useDownloadChatAttachment } from "../api/chatMutations";
import { useChatAttachmentBlob } from "../api/chatQueries";
import type { ChatAttachmentDto } from "../types";
import { displayFileName, formatFileSize } from "../utils/chatFormat";

interface MessageAttachmentsProps {
  messageId: string;
  attachments: ChatAttachmentDto[];
}

/** Pictures shown inline (click to enlarge), other files as download chips. */
export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({ messageId, attachments }) => (
  <div className="chat-attachments">
    {attachments.map((attachment) =>
      attachment.isImage ? (
        <ChatImage key={attachment.id} messageId={messageId} attachment={attachment} />
      ) : (
        <ChatFile key={attachment.id} messageId={messageId} attachment={attachment} />
      ),
    )}
  </div>
);

interface AttachmentProps {
  messageId: string;
  attachment: ChatAttachmentDto;
}

/** The file is stored encrypted; the API hands back the opened bytes, shown from a blob URL. */
function ChatImage({ messageId, attachment }: AttachmentProps) {
  const { data } = useChatAttachmentBlob(messageId, attachment.id, true);
  const url = useMemo(() => (data ? URL.createObjectURL(data) : undefined), [data]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (!url) {
    return (
      <span className="chat-image chat-image--loading">
        <Spin size="small" />
      </span>
    );
  }
  return <Image className="chat-image" src={url} alt={displayFileName(attachment.fileName)} width={200} />;
}

function ChatFile({ messageId, attachment }: AttachmentProps) {
  const download = useDownloadChatAttachment();

  const handleDownload = () => {
    download.mutate(
      { messageId, attachmentId: attachment.id },
      { onSuccess: (blob) => downloadBlob(blob, displayFileName(attachment.fileName)) },
    );
  };

  return (
    <button
      type="button"
      className="chat-file"
      aria-label={t("Chat:Download", displayFileName(attachment.fileName))}
      disabled={download.isPending}
      onClick={handleDownload}
    >
      <FileText size={20} className="chat-file-icon" aria-hidden />
      <span className="chat-file-text">
        <span className="chat-file-name">{displayFileName(attachment.fileName)}</span>
        <span className="chat-file-size">{formatFileSize(attachment.sizeInBytes)}</span>
      </span>
      {download.isPending ? <Spin size="small" /> : <Download size={16} aria-hidden />}
    </button>
  );
}
