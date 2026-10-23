import { useState } from "react";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import type { ConversationDetail } from "../../api/inboxApi";
import { customerName } from "../../inboxLook";
import { CustomerSections } from "./CustomerSections";
import { InboxAvatar } from "./InboxAvatar";
import { NotesSection } from "../notes/NotesSection";
import { LinkPatientPicker } from "./LinkPatientPicker";
import { TagEditor } from "./TagEditor";

interface Props {
  conversation: ConversationDetail;
  canHandle: boolean;
}

/**
 * The right column: the customer — "[DH260042] Trần Thái An", phone, tags —
 * their appointments, treatment and debt when a record is linked, and the
 * internal notes. Without a record, the picker to link one.
 */
export function CustomerPanel({ conversation, canHandle }: Props) {
  const [relinking, setRelinking] = useState(false);
  const customer = conversation.customer;
  const name = customerName(conversation);
  const phone = customer?.phone ?? conversation.sharedPhone;

  return (
    <aside className="ibx-side" aria-label={t("CSKH:Inbox:Panel:Label")}>
      <section className="ibx-side-block ibx-side-card">
        <div className="ibx-side-who">
          <InboxAvatar name={name} avatarUrl={conversation.avatarUrl} size="lg" />
          <div className="bd-min0">
            <p className="ibx-side-name">{customer ? `[${customer.code}] ${customer.name}` : name}</p>
            <p className="ibx-side-phone">{phone ?? t("CSKH:Inbox:Panel:NoPhone")}</p>
          </div>
        </div>
        <TagEditor conversationId={conversation.id} tags={conversation.tags} canEdit={canHandle} />
        {!customer && <p className="ibx-side-text">{t("CSKH:Inbox:Panel:NotLinked")}</p>}
        {canHandle && (!customer || relinking) && (
          <LinkPatientPicker conversationId={conversation.id} onDone={() => setRelinking(false)} />
        )}
        {canHandle && customer && (
          <Button size="small" type="link" className="ibx-side-relink" onClick={() => setRelinking((v) => !v)}>
            {relinking ? t("Common:CancelAlt") : t("CSKH:Inbox:Panel:Relink")}
          </Button>
        )}
      </section>
      {customer && <CustomerSections customer={customer} />}
      <NotesSection owner={{ kind: "conversation", id: conversation.id }} canEdit={canHandle} />
    </aside>
  );
}
