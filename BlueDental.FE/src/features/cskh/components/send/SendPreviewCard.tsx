import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { useSendPreview, type MessageRecipient } from "../../api/sendApi";
import { MESSAGE_CHANNEL, type MessageChannel, type MessagePreview } from "../../api/templateApi";
import { previewTargetOf } from "../../sendRecipients";
import { EditorCard } from "../template-editor/EditorCard";

interface SendPreviewCardProps {
  channel: MessageChannel;
  channelName: string;
  templateId: string | null;
  /** The first customer the send reaches, else the first on the list. */
  target: MessageRecipient | null;
}

function Bubble({ channel, preview }: { channel: MessageChannel; preview: MessagePreview }) {
  return (
    <div className="tpl-preview-bubble">
      {preview.subject && <div className="tpl-preview-subject">{t("CSKH:Template:SubjectLine", preview.subject)}</div>}
      {channel === MESSAGE_CHANNEL.Zalo
        ? preview.params.map((param) => (
            <div key={param.name} className="tpe-preview-param">
              <span className="tpl-muted">{param.name}:</span> {param.value}
            </div>
          ))
        : preview.text}
    </div>
  );
}

/** XEM TRƯỚC: the message the first customer of this send gets, variables filled in. */
export function SendPreviewCard({ channel, channelName, templateId, target }: SendPreviewCardProps) {
  const input = templateId && target ? { templateId, ...previewTargetOf(target) } : null;
  const preview = useSendPreview(input);

  return (
    <EditorCard className="snd-preview">
      <span className="tpl-eyebrow">{t("CSKH:Send:PreviewEyebrow", channelName)}</span>
      {input && target ? (
        <>
          <span className="snd-preview-for">
            {t("CSKH:Send:PreviewFor")} <strong>{target.name}</strong>
          </span>
          <div className="tpl-preview-stage">
            {preview.data ? <Bubble channel={channel} preview={preview.data} /> : <Spin size="small" />}
          </div>
        </>
      ) : (
        <p className="tpl-muted">{t("CSKH:Send:PreviewNone")}</p>
      )}
    </EditorCard>
  );
}
