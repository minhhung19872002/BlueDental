import React, { useState } from "react";
import { Button, Modal, Tag } from "antd";
import { UserMinus } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { useRemoveChatMember } from "../api/chatMutations";
import type { ChatConversationDto, ChatMemberDto } from "../types";
import { initialsOf } from "../utils/chatFormat";

interface MembersDialogProps {
  conversation: ChatConversationDto;
  onClose: () => void;
}

/**
 * Who is in a group, longest-standing first, with the owner marked. The owner
 * can take anyone else out (R-1158); everyone else only reads the list.
 */
export const MembersDialog: React.FC<MembersDialogProps> = ({ conversation, onClose }) => {
  const [removing, setRemoving] = useState<ChatMemberDto | null>(null);
  const remove = useRemoveChatMember();

  const handleConfirmRemove = () => {
    if (!removing) return;
    remove.mutate(
      { conversationId: conversation.id, userId: removing.userId },
      { onSuccess: () => setRemoving(null) },
    );
  };

  return (
    <Modal
      open
      title={t("Chat:MemberList")}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("Chat:Close")}</Button>}
      width={460}
      destroyOnHidden
    >
      <ul className="chat-member-list" aria-label={t("Chat:MemberList")}>
        {conversation.members.map((member) => {
          const isOwner = member.userId === conversation.ownerId;
          return (
            <li key={member.userId} className="chat-member">
              <span className="chat-avatar chat-avatar--small" aria-hidden>
                {initialsOf(member.fullName)}
              </span>
              <span className="chat-member-name">{member.fullName}</span>
              {isOwner && <Tag color="blue">{t("Chat:Owner")}</Tag>}
              {conversation.isOwnedByMe && !isOwner && (
                <button
                  type="button"
                  className="chat-icon-button chat-icon-button--danger"
                  aria-label={t("Chat:RemoveMember", member.fullName)}
                  title={t("Chat:RemoveMember", member.fullName)}
                  onClick={() => setRemoving(member)}
                >
                  <UserMinus size={16} aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title={t("Chat:RemoveMemberTitle")}
        message={t("Chat:RemoveMemberConfirm", removing?.fullName ?? "", conversation.title)}
        confirmLabel={t("Chat:Remove")}
        cancelLabel={t("Chat:Cancel")}
        pending={remove.isPending}
        onConfirm={handleConfirmRemove}
        onClose={() => setRemoving(null)}
      />
    </Modal>
  );
};
