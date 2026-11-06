import React, { useState } from "react";
import { Dropdown, type MenuProps } from "antd";
import { MoreHorizontal } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { useLeaveChat } from "../api/chatMutations";
import type { ChatConversationDto } from "../types";
import { AddMembersDialog } from "./AddMembersDialog";
import { MembersDialog } from "./MembersDialog";
import { RenameGroupDialog } from "./RenameGroupDialog";

type ThreadAction = "members" | "rename" | "add" | "leave";

interface ThreadMenuProps {
  conversation: ChatConversationDto;
  /** After leaving, the thread is no longer the caller's: back to the list. */
  onLeft: () => void;
}

/** A group's "…" menu: members (the owner removes people there), rename, add people, leave. */
export const ThreadMenu: React.FC<ThreadMenuProps> = ({ conversation, onLeft }) => {
  const [action, setAction] = useState<ThreadAction | null>(null);
  const leave = useLeaveChat();
  const close = () => setAction(null);

  const items: MenuProps["items"] = [
    { key: "members", label: t("Chat:MemberList") },
    { key: "rename", label: t("Chat:Rename") },
    { key: "add", label: t("Chat:AddMembers") },
    { type: "divider" },
    { key: "leave", label: t("Chat:Leave"), danger: true },
  ];

  const handleLeave = () => {
    leave.mutate(conversation.id, {
      onSuccess: () => {
        close();
        onLeft();
      },
    });
  };

  return (
    <>
      <Dropdown
        menu={{ items, onClick: ({ key }) => setAction(key as ThreadAction) }}
        trigger={["click"]}
        placement="bottomRight"
      >
        <button type="button" className="chat-icon-button" aria-label={t("Chat:More")} title={t("Chat:More")}>
          <MoreHorizontal size={18} aria-hidden />
        </button>
      </Dropdown>
      {action === "members" && <MembersDialog conversation={conversation} onClose={close} />}
      {action === "rename" && <RenameGroupDialog conversation={conversation} onClose={close} />}
      {action === "add" && <AddMembersDialog conversation={conversation} onClose={close} />}
      <ConfirmDialog
        open={action === "leave"}
        title={t("Chat:Leave")}
        message={t("Chat:LeaveConfirm", conversation.title)}
        confirmLabel={t("Chat:Leave")}
        cancelLabel={t("Chat:Cancel")}
        pending={leave.isPending}
        onConfirm={handleLeave}
        onClose={close}
      />
    </>
  );
};
