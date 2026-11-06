import React, { useState } from "react";
import { Button, Modal } from "antd";
import { useBranchFilter } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { useAddChatMembers } from "../api/chatMutations";
import type { ChatContactDto, ChatConversationDto } from "../types";
import { ContactPicker } from "./ContactPicker";
import { SelectedContacts } from "./SelectedContacts";

interface AddMembersDialogProps {
  conversation: ChatConversationDto;
  onClose: () => void;
}

/** Anyone in a group may add people from the branch; current members are not offered. */
export const AddMembersDialog: React.FC<AddMembersDialogProps> = ({ conversation, onClose }) => {
  const branchId = useBranchFilter();
  const [picked, setPicked] = useState<ChatContactDto[]>([]);
  const addMembers = useAddChatMembers();
  const memberIds = conversation.members.map((member) => member.userId);

  const handleToggle = (contact: ChatContactDto) => {
    setPicked((current) =>
      current.some((c) => c.id === contact.id) ? current.filter((c) => c.id !== contact.id) : [...current, contact],
    );
  };

  const handleAdd = () => {
    addMembers.mutate({ id: conversation.id, userIds: picked.map((c) => c.id) }, { onSuccess: onClose });
  };

  const footer = (
    <>
      <Button onClick={onClose}>{t("Chat:Cancel")}</Button>
      <Button
        type="primary"
        loading={addMembers.isPending}
        disabled={picked.length === 0 || addMembers.isPending}
        onClick={handleAdd}
      >
        {t("Chat:Add")}
      </Button>
    </>
  );

  return (
    <Modal open title={t("Chat:AddMembers")} onCancel={onClose} footer={footer} width={460} destroyOnHidden>
      <div className="chat-new">
        <SelectedContacts contacts={picked} onRemove={handleToggle} />
        <ContactPicker
          branchId={branchId}
          selectedIds={picked.map((c) => c.id)}
          excludeIds={memberIds}
          onPick={handleToggle}
          disabled={addMembers.isPending}
        />
      </div>
    </Modal>
  );
};
