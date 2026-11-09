import React, { useMemo } from "react";
import { Button, Modal } from "antd";
import { t } from "@/lib/i18n";
import type { ChatMemberDto, ChatMessageDto } from "../types";
import { initialsOf } from "../utils/chatFormat";
import { formatSeenTime, seenDetail, type ChatReader } from "../utils/chatSeen";

interface SeenDialogProps {
  message: ChatMessageDto;
  /** The members whose read mark rests on this message: only they get a time. */
  readers: readonly ChatReader[];
  members: readonly ChatMemberDto[];
  onClose: () => void;
}

/** Who in the group has and has not seen one message (R-1178). */
export const SeenDialog: React.FC<SeenDialogProps> = ({ message, readers, members, onClose }) => {
  const { seen, notSeen } = useMemo(() => seenDetail(message, members, readers), [message, members, readers]);
  const someUntimed = seen.some((entry) => entry.readAt === null);

  return (
    <Modal
      open
      title={t("Chat:SeenTitle")}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("Chat:Close")}</Button>}
      width={460}
      destroyOnHidden
    >
      <div className="chat-seen-columns">
        <SeenColumn title={t("Chat:SeenList", seen.length)}>
          {seen.map((entry) => (
            <SeenPerson key={entry.userId} name={entry.fullName} time={entry.readAt && formatSeenTime(entry.readAt)} />
          ))}
        </SeenColumn>
        <SeenColumn title={t("Chat:NotSeenList", notSeen.length)}>
          {notSeen.map((member) => (
            <SeenPerson key={member.userId} name={member.fullName} time={null} />
          ))}
        </SeenColumn>
      </div>
      {someUntimed && <p className="chat-seen-hint">{t("Chat:SeenHint")}</p>}
    </Modal>
  );
};

function SeenColumn({ title, children }: { title: string; children: React.ReactNode[] }) {
  return (
    <section className="chat-seen-column" aria-label={title}>
      <h4 className="chat-seen-column-title">{title}</h4>
      {children.length > 0 ? (
        <ul className="chat-member-list">{children}</ul>
      ) : (
        <p className="chat-seen-empty">{t("Chat:SeenNobody")}</p>
      )}
    </section>
  );
}

function SeenPerson({ name, time }: { name: string; time: string | null }) {
  return (
    <li className="chat-member">
      <span className="chat-avatar chat-avatar--small" aria-hidden>
        {initialsOf(name)}
      </span>
      <span className="chat-member-name">{name}</span>
      {time && <span className="chat-seen-time">{time}</span>}
    </li>
  );
}
