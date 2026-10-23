import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { INBOX_LIMITS, useSendChatMessage } from "../../api/inboxApi";

interface Props {
  conversationId: string;
  /** Held by the viewer, who may handle the inbox. */
  canReply: boolean;
  /** Zalo's 48-hour window for a "tin tư vấn" is still open. */
  windowOpen: boolean;
  hoursLeft: number;
}

/**
 * The reply box: a text "tin tư vấn" through the OA, up to 2.000 characters,
 * only while the 48 hours since the customer's last message run. Ctrl+Enter
 * sends; the text stays when Zalo refuses it.
 */
export function ChatComposer({ conversationId, canReply, windowOpen, hoursLeft }: Props) {
  const [text, setText] = useState("");
  const send = useSendChatMessage();
  const enabled = canReply && windowOpen;
  const ready = enabled && text.trim().length > 0 && !send.isPending;

  const handleSend = () => {
    if (!ready) return;
    send.mutate({ id: conversationId, text: text.trim() }, { onSuccess: () => setText("") });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ibx-composer">
      <div className="ibx-composer-row">
        <Input.TextArea
          aria-label={t("CSKH:Inbox:Reply")}
          placeholder={canReply ? t("CSKH:Inbox:ReplyPlaceholder") : t("CSKH:Inbox:ReplyLocked")}
          autoSize={{ minRows: 2, maxRows: 6 }}
          maxLength={INBOX_LIMITS.message}
          disabled={!enabled || send.isPending}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="primary" icon={<SendOutlined />} loading={send.isPending} disabled={!ready} onClick={handleSend}>
          {t("CSKH:Inbox:SendReply")}
        </Button>
      </div>
      <p className="ibx-composer-foot">
        {[
          t("CSKH:Inbox:CharCount", formatVND(text.length), formatVND(INBOX_LIMITS.message)),
          t("CSKH:Inbox:TinTuVan"),
          windowOpen
            ? t("CSKH:Inbox:WindowLeft", hoursLeft, INBOX_LIMITS.replyWindowHours)
            : t("CSKH:Inbox:WindowClosed", INBOX_LIMITS.replyWindowHours),
        ].join(" · ")}
      </p>
    </div>
  );
}
