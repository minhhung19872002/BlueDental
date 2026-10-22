import { Button } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { channelLabels, MESSAGE_CHANNEL, type MessageTemplateDto } from "../../api/templateApi";
import { lastUsedLabel, smsMeasureLabel } from "./templateLook";
import { TemplateStatusBadge } from "./TemplateStatusBadge";
import { VariableText } from "./VariableText";

interface TemplatePreviewCardProps {
  template: MessageTemplateDto | null;
  duplicating: boolean;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onUseToSend?: () => void;
}

function PreviewBody({ template }: { template: MessageTemplateDto }) {
  return (
    <div className="tpl-preview-stage">
      <div className="tpl-preview-bubble">
        {template.channel === MESSAGE_CHANNEL.Zalo && template.externalTemplateId && (
          <div className="tpl-preview-ref">{t("CSKH:Template:ZnsRef", template.externalTemplateId)}</div>
        )}
        {template.subject && (
          <div className="tpl-preview-subject">
            <VariableText text={t("CSKH:Template:SubjectLine", template.subject)} />
          </div>
        )}
        <VariableText text={template.content} />
      </div>
    </div>
  );
}

/** Right-hand card of the template list: the picked template as a customer would read it. */
export function TemplatePreviewCard({
  template,
  duplicating,
  onEdit,
  onDuplicate,
  onUseToSend,
}: TemplatePreviewCardProps) {
  if (!template) {
    return <aside className="tpl-preview-card tpl-preview-card--empty">{t("CSKH:Template:PickToPreview")}</aside>;
  }

  return (
    <aside className="tpl-preview-card" aria-label={template.name}>
      <header className="tpl-preview-head">
        <div>
          <div className="tpl-eyebrow">{t("CSKH:Template:PreviewOf", channelLabels()[template.channel])}</div>
          <div className="tpl-preview-name">{template.name}</div>
        </div>
        <TemplateStatusBadge status={template.status} />
      </header>

      <PreviewBody template={template} />

      <div className="tpl-preview-facts">
        {template.measure && <span className="tpl-fact">{smsMeasureLabel(template.measure)}</span>}
        <span className="tpl-fact">{lastUsedLabel(template.lastUsedAt)}</span>
      </div>

      <div className="tpl-eyebrow">{t("CSKH:Template:VariablesInTemplate")}</div>
      <div className="tpl-var-list">
        {template.variables.length === 0 ? (
          <span className="tpl-muted">{t("CSKH:Template:NoVariables")}</span>
        ) : (
          template.variables.map((key) => (
            <span key={key} className="tpl-var">{`{${key}}`}</span>
          ))
        )}
      </div>

      <footer className="tpl-preview-actions">
        {onEdit && (
          <Button className="tpl-soft-btn" onClick={onEdit}>
            {t("CSKH:Template:Edit")}
          </Button>
        )}
        {onDuplicate && (
          <Button type="text" className="tpl-text-btn" disabled={duplicating} icon={duplicating ? <LoadingOutlined /> : undefined} onClick={onDuplicate}>
            {t("CSKH:Template:Duplicate")}
          </Button>
        )}
        {onUseToSend && (
          <Button type="primary" onClick={onUseToSend}>
            {t("CSKH:Template:UseToSend")}
          </Button>
        )}
      </footer>
    </aside>
  );
}
