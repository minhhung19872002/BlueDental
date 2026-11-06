import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateGroupChatInput, EditChatMessageInput, SendChatMessageInput } from "../types";
import { chatApi } from "./chatApi";
import { chatKeys } from "./chatQueries";

interface UploadChatAttachmentInput {
  conversationId: string;
  file: File;
  onProgress?: (percent: number) => void;
}

/** Every chat write can move the list order, a thread and the unread badge. */
function useInvalidateChat() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: chatKeys.all });
}

export function useOpenDirectChat() {
  const invalidate = useInvalidateChat();
  return useMutation({ mutationFn: chatApi.openDirect, onSuccess: invalidate });
}

export function useCreateGroupChat() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: CreateGroupChatInput) => chatApi.createGroup(input),
    onSuccess: invalidate,
  });
}

export function useRenameChat() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => chatApi.rename(id, name),
    onSuccess: invalidate,
  });
}

export function useAddChatMembers() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) => chatApi.addMembers(id, userIds),
    onSuccess: invalidate,
  });
}

export function useLeaveChat() {
  const invalidate = useInvalidateChat();
  return useMutation({ mutationFn: chatApi.leave, onSuccess: invalidate });
}

/** Owner only; the server says no to anyone else (R-1158). */
export function useRemoveChatMember() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: ({ conversationId, userId }: { conversationId: string; userId: string }) =>
      chatApi.removeMember(conversationId, userId),
    onSuccess: invalidate,
  });
}

/** Read marks fire on their own; a failed one is retried by the next open, not toasted. */
export function useMarkChatRead() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: chatApi.markRead,
    onSuccess: invalidate,
    meta: { skipGlobalErrorToast: true },
  });
}

export function useUploadChatAttachment() {
  return useMutation({
    mutationFn: ({ conversationId, file, onProgress }: UploadChatAttachmentInput) =>
      chatApi.upload(conversationId, file, onProgress),
  });
}

export function useSendChatMessage() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: SendChatMessageInput) => chatApi.send(input),
    onSuccess: invalidate,
  });
}

export function useEditChatMessage() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: (input: EditChatMessageInput) => chatApi.edit(input),
    onSuccess: invalidate,
  });
}

export function useRecallChatMessage() {
  const invalidate = useInvalidateChat();
  return useMutation({ mutationFn: chatApi.recall, onSuccess: invalidate });
}

export function useDownloadChatAttachment() {
  return useMutation({
    mutationFn: ({ messageId, attachmentId }: { messageId: string; attachmentId: string }) =>
      chatApi.attachment(messageId, attachmentId),
  });
}
