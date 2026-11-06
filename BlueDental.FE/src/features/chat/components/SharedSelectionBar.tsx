import React, { useState } from "react";
import { Button } from "antd";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { downloadBlob } from "@/utils/download";
import { useDownloadChatAttachment } from "../api/chatMutations";
import { displayFileName } from "../utils/chatFormat";
import type { SharedPick } from "../utils/chatShared";

interface SharedSelectionBarProps {
  selected: ReadonlyMap<string, SharedPick>;
  /** The action went through: leave the "Chọn" mode. */
  onDone: () => void;
}

/** The foot of Kho lưu trữ while choosing: download the ticked files, or copy the ticked links. */
export const SharedSelectionBar: React.FC<SharedSelectionBarProps> = ({ selected, onDone }) => {
  const download = useDownloadChatAttachment();
  const [busy, setBusy] = useState(false);
  const picks = [...selected.values()];
  const files = picks.flatMap((pick) => (pick.kind === "file" ? [pick.item] : []));
  const links = picks.flatMap((pick) => (pick.kind === "link" ? [pick.item] : []));

  // One after another: the server decrypts each file, and the browser asks once about several downloads.
  const handleDownload = async () => {
    setBusy(true);
    try {
      for (const file of files) {
        const blob = await download.mutateAsync({ messageId: file.messageId, attachmentId: file.attachment.id });
        downloadBlob(blob, displayFileName(file.attachment.fileName));
      }
      onDone();
    } catch {
      // The mutation cache has shown the error; the files after the failed one are left ticked to retry.
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(links.map((link) => link.url).join("\n"));
      toast.success(t("Chat:LinksCopied", links.length));
      onDone();
    } catch {
      // No clipboard on a plain-HTTP host, or the browser refused it.
      notifyError(t("Chat:CopyFailed"));
    }
  };

  return (
    <div className="chat-shared-bar" role="toolbar" aria-label={t("Chat:Library")}>
      <span className="chat-shared-bar-count" aria-live="polite">
        {t("Chat:SharedSelectedCount", selected.size)}
      </span>
      {links.length > 0 ? (
        <Button type="primary" icon={<Copy size={15} aria-hidden />} onClick={() => void handleCopy()}>
          {t("Chat:CopyLinks")}
        </Button>
      ) : (
        <Button
          type="primary"
          loading={busy}
          disabled={files.length === 0}
          icon={<Download size={15} aria-hidden />}
          onClick={() => void handleDownload()}
        >
          {t("Chat:DownloadSelected")}
        </Button>
      )}
    </div>
  );
};
