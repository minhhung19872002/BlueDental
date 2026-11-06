import { useEffect, useRef, useState } from "react";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { useUploadChatAttachment } from "../api/chatMutations";
import { CHAT_LIMITS } from "../types";
import { rejectChatFile } from "../utils/chatFormat";

export interface PendingChatFile {
  key: string;
  name: string;
  /** Set once the upload is stored; the message sends these ids. */
  attachmentId?: string;
  /** Whole percent sent so far; at 100 the server is still scanning and sealing it. */
  progress: number;
  /** The upload failed (network, scan, size): the chip offers to try again or drop it. */
  failed: boolean;
}

interface UploadSource {
  file: File;
  controller: AbortController | null;
}

let nextFileKey = 0;

/**
 * Files picked for the next message, each uploading on its own (R-1162):
 * × stops an upload still on its way, a failed one stays as a chip to try
 * again or drop, and leaving the thread stops whatever is still uploading.
 */
export function usePendingUploads(conversationId: string) {
  const [files, setFiles] = useState<PendingChatFile[]>([]);
  const sourcesRef = useRef(new Map<string, UploadSource>());
  const upload = useUploadChatAttachment();
  const { mutateAsync } = upload;

  useEffect(() => {
    const sources = sourcesRef.current;
    return () => sources.forEach((source) => source.controller?.abort());
  }, []);

  const patch = (key: string, change: Partial<PendingChatFile>) =>
    setFiles((current) => current.map((file) => (file.key === key ? { ...file, ...change } : file)));

  const start = (key: string, file: File) => {
    const controller = new AbortController();
    sourcesRef.current.set(key, { file, controller });
    patch(key, { progress: 0, failed: false });
    // A failure is toasted by the global mutation handler (a cancel is not).
    mutateAsync({ conversationId, file, signal: controller.signal, onProgress: (progress) => patch(key, { progress }) })
      .then((stored) => patch(key, { attachmentId: stored.id }))
      .catch(() => {
        if (!controller.signal.aborted) patch(key, { failed: true });
      })
      .finally(() => {
        const source = sourcesRef.current.get(key);
        if (source?.controller === controller) source.controller = null;
      });
  };

  const add = (picked: File[]) => {
    const room = CHAT_LIMITS.maxAttachmentsPerMessage - files.length;
    if (picked.length > room) notifyError(t("Chat:TooManyFiles", CHAT_LIMITS.maxAttachmentsPerMessage));
    for (const file of picked.slice(0, Math.max(room, 0))) {
      const reason = rejectChatFile(file);
      if (reason) {
        notifyError(reason);
        continue;
      }
      const key = `f${++nextFileKey}`;
      setFiles((current) => [...current, { key, name: file.name, progress: 0, failed: false }]);
      start(key, file);
    }
  };

  const retry = (key: string) => {
    const source = sourcesRef.current.get(key);
    if (source && !source.controller) start(key, source.file);
  };

  /** Drops a file; one still uploading is stopped first. */
  const remove = (key: string) => {
    sourcesRef.current.get(key)?.controller?.abort();
    sourcesRef.current.delete(key);
    setFiles((current) => current.filter((file) => file.key !== key));
  };

  const clear = () => {
    sourcesRef.current.clear();
    setFiles([]);
  };

  return {
    files,
    add,
    retry,
    remove,
    clear,
    ready: files.flatMap((file) => (file.attachmentId ? [file.attachmentId] : [])),
    uploading: files.some((file) => !file.attachmentId && !file.failed),
    failed: files.some((file) => file.failed),
  };
}
