import React from "react";
import { Tag } from "antd";
import { t } from "@/lib/i18n";
import type { ChatContactDto } from "../types";

interface SelectedContactsProps {
  contacts: ChatContactDto[];
  onRemove: (contact: ChatContactDto) => void;
}

/** The people picked so far, each removable. */
export const SelectedContacts: React.FC<SelectedContactsProps> = ({ contacts, onRemove }) => {
  if (contacts.length === 0) return null;
  return (
    <div className="chat-selected">
      <span className="chat-selected-count">{t("Chat:SelectedCount", contacts.length)}</span>
      {contacts.map((contact) => (
        <Tag key={contact.id} closable onClose={() => onRemove(contact)}>
          {contact.fullName}
        </Tag>
      ))}
    </div>
  );
};
