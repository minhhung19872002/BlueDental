import { t } from "@/lib/i18n";
import { channelLabels, MESSAGE_CHANNEL, type MessageChannel } from "../../api/templateApi";
import { EditorCard } from "./EditorCard";

const RULE_KEYS: Record<MessageChannel, readonly string[]> = {
  [MESSAGE_CHANNEL.Sms]: ["CSKH:Template:Rule:Sms1", "CSKH:Template:Rule:Sms2", "CSKH:Template:Rule:Sms3"],
  [MESSAGE_CHANNEL.Zalo]: ["CSKH:Template:Rule:Zalo1", "CSKH:Template:Rule:Zalo2", "CSKH:Template:Rule:Zalo3"],
  [MESSAGE_CHANNEL.Email]: ["CSKH:Template:Rule:Email1", "CSKH:Template:Rule:Email2", "CSKH:Template:Rule:Email3"],
};

/** "Quy định kênh SMS": the three things the BA lists under the preview. */
export function ChannelRules({ channel }: { channel: MessageChannel }) {
  return (
    <EditorCard className="tpe-rules" title={t("CSKH:Template:Rules", channelLabels()[channel])}>
      <ul className="tpe-rule-list">
        {RULE_KEYS[channel].map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </EditorCard>
  );
}
