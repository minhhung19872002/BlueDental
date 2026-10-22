import { Button } from "antd";
import { SwapOutlined, WarningOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import {
  channelLabels,
  MESSAGE_CHANNEL,
  type MessageChannel,
  type MessagePreview,
  type SampleCustomer,
} from "../../api/templateApi";
import { variableLabel } from "../../messageVariables";
import { EditorCard } from "./EditorCard";

interface TemplatePreviewPanelProps {
  channel: MessageChannel;
  customer: SampleCustomer | undefined;
  preview: MessagePreview | undefined;
  changing: boolean;
  onChangeCustomer: () => void;
}

function PreviewBubble({ channel, preview }: { channel: MessageChannel; preview: MessagePreview | undefined }) {
  if (!preview) return <div className="tpl-preview-bubble tpe-preview-empty">{t("CSKH:Template:PreviewEmpty")}</div>;
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

function customerCaption(customer: SampleCustomer | undefined, preview: MessagePreview | undefined): string | null {
  if (preview?.isSample || (customer && !customer.patientId)) return t("CSKH:Template:PreviewSample");
  if (!customer?.name) return null;
  return t("CSKH:Template:PreviewCustomer", customer.name, customer.code ?? "");
}

/** XEM TRƯỚC: the message one real customer of the branch would get; "Đổi khách" picks another. */
export function TemplatePreviewPanel({ channel, customer, preview, changing, onChangeCustomer }: TemplatePreviewPanelProps) {
  const caption = customerCaption(customer, preview);
  const missing = preview?.missing ?? [];

  return (
    <EditorCard className="tpe-preview" title={t("CSKH:Template:PreviewOf", channelLabels()[channel])}>
      <div className="tpl-preview-stage">
        <PreviewBubble channel={channel} preview={preview} />
      </div>
      <div className="tpe-preview-caption">
        <span className="tpl-muted">{caption}</span>
        {customer?.patientId && (
          <Button
            type="text"
            size="small"
            className="tpl-text-btn"
            icon={<SwapOutlined />}
            disabled={changing}
            loading={changing}
            onClick={onChangeCustomer}
          >
            {t("CSKH:Template:OtherCustomer")}
          </Button>
        )}
      </div>
      {missing.length > 0 && (
        <p className="tpe-warn">
          <WarningOutlined />
          {t("CSKH:Template:PreviewMissing", missing.map(variableLabel).join(", "))}
        </p>
      )}
    </EditorCard>
  );
}
