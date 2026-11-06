import { describeApiError } from "@/lib/apiError";
import { useEditChatMessage } from "../api/chatMutations";
import { useReloadChatMessage } from "../api/chatQueries";
import { CHAT_ERROR_CODES, type ChatMessageDto } from "../types";
import { isStillEditable } from "./useEditWindow";

/**
 * Saves an edit (R-1159). It sends the edit stamp the editor started from, so
 * an edit made elsewhere in the meantime is refused instead of overwritten.
 * The server's own words are toasted by the global mutation handler; this
 * only decides what happens to the edit box:
 *  - edited elsewhere → reload the message and carry on editing on top of it,
 *    keeping what was typed (or stop if the window has closed meanwhile);
 *  - window closed → stop editing.
 */
export function useEditSubmit(conversationId: string, onEditingChange: (message: ChatMessageDto | null) => void) {
  const edit = useEditChatMessage();
  const reloadMessage = useReloadChatMessage(conversationId);

  const handleError = async (error: unknown, editing: ChatMessageDto) => {
    const { code } = describeApiError(error);
    if (code === CHAT_ERROR_CODES.editWindowExpired) {
      onEditingChange(null);
      return;
    }
    if (code !== CHAT_ERROR_CODES.editConflict) return;
    const fresh = await reloadMessage(editing.id);
    onEditingChange(fresh && isStillEditable(fresh) ? fresh : null);
  };

  const save = (editing: ChatMessageDto, content: string, patientIds: string[]) =>
    edit.mutate(
      { messageId: editing.id, content, patientIds, expectedEditedAt: editing.editedAt },
      {
        onSuccess: () => onEditingChange(null),
        onError: (error) => void handleError(error, editing),
      },
    );

  return { save, saving: edit.isPending };
}
