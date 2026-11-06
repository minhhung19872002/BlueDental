import React, { useState } from "react";
import { Input, Spin } from "antd";
import { Check, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { useChatContacts } from "../api/chatQueries";
import type { ChatContactDto } from "../types";
import { initialsOf } from "../utils/chatFormat";
import { ChatStatus } from "./ChatStatus";

interface ContactPickerProps {
  branchId: string | undefined;
  /** Given in multi-pick mode: rows show a tick and toggle. */
  selectedIds?: readonly string[];
  /** People already in the conversation, left out of the list. */
  excludeIds?: readonly string[];
  onPick: (contact: ChatContactDto) => void;
  disabled?: boolean;
}

/** Staff of the branch the caller can chat with, searched on the server. */
export const ContactPicker: React.FC<ContactPickerProps> = ({ branchId, selectedIds, excludeIds, onPick, disabled }) => {
  const [search, setSearch] = useState("");
  const filter = useDebounce(search.trim());
  const { data, isLoading, isError, refetch } = useChatContacts(branchId, filter, true);
  const contacts = (data ?? []).filter((contact) => !excludeIds?.includes(contact.id));

  return (
    <div className="chat-contact-picker">
      <Input
        allowClear
        autoFocus
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("Chat:SearchContacts")}
        prefix={<Search size={15} aria-hidden />}
        aria-label={t("Chat:SearchContacts")}
      />
      <div className="chat-contact-list">
        {isLoading && <Spin className="chat-spin" />}
        {isError && <ChatStatus text={t("Chat:LoadError")} onRetry={() => void refetch()} />}
        {!isLoading && !isError && contacts.length === 0 && <ChatStatus text={t("Chat:NoContacts")} />}
        {contacts.map((contact) => {
          const picked = selectedIds?.includes(contact.id) ?? false;
          return (
            <button
              key={contact.id}
              type="button"
              className={["chat-contact", picked && "chat-contact--picked"].filter(Boolean).join(" ")}
              role={selectedIds ? "checkbox" : undefined}
              aria-checked={selectedIds ? picked : undefined}
              disabled={disabled}
              onClick={() => onPick(contact)}
            >
              <span className="chat-avatar chat-avatar--small" aria-hidden>
                {initialsOf(contact.fullName)}
              </span>
              <span className="chat-contact-name">
                {contact.fullName}
                <span className="chat-contact-user">{contact.userName}</span>
              </span>
              {picked && <Check size={16} className="chat-contact-check" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
