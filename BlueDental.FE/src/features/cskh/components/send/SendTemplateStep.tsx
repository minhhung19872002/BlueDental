import { Link } from "react-router-dom";
import { DownOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { MessageTemplateDto } from "../../api/templateApi";
import { useDismissable } from "../../hooks/useDismissable";
import { EditorCard } from "../template-editor/EditorCard";
import { purposeLabel } from "../templates/templateLook";
import { TemplateStatusBadge } from "../templates/TemplateStatusBadge";
import { SendTemplateMenu } from "./SendTemplateMenu";

interface SendTemplateStepProps {
  channelName: string;
  templates: readonly MessageTemplateDto[];
  template: MessageTemplateDto | null;
  createPath: string;
  listPath: string;
  onPick: (id: string) => void;
}

function TemplateSummary({ template }: { template: MessageTemplateDto }) {
  const lastUsed = template.lastUsedAt
    ? t("CSKH:Send:LastUsed", formatDate(template.lastUsedAt))
    : t("CSKH:Send:NeverUsed");
  return (
    <span className="snd-trigger-body">
      <span className="snd-trigger-name">{template.name}</span>
      <span className="snd-trigger-meta">
        {t("CSKH:Send:PurposeLabel")} <strong>{purposeLabel(template.purpose)}</strong>
        {" · "}
        {t("CSKH:Send:SentCount", template.sentCount)}
        {" · "}
        {lastUsed}
      </span>
    </span>
  );
}

/**
 * Step 2 — Mẫu {kênh}. The trigger shows the picked template; its pop-down
 * lists every template of the channel, "Sẵn sàng" first, and only those can
 * be picked.
 */
export function SendTemplateStep({ channelName, templates, template, createPath, listPath, onPick }: SendTemplateStepProps) {
  const menu = useDismissable<HTMLDivElement>();

  const handlePick = (id: string) => {
    onPick(id);
    menu.close();
  };

  return (
    <EditorCard
      step={2}
      title={t("CSKH:Send:TemplateOf", channelName)}
      extra={
        <Link className="snd-link" to={createPath}>
          <PlusOutlined /> {t("CSKH:Send:CreateTemplateOf", channelName)}
        </Link>
      }
    >
      <div className="snd-field" ref={menu.ref}>
        <span className="snd-field-label" id="snd-template-label">
          {t("CSKH:Send:PickTemplate", channelName)}
        </span>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={menu.open}
          aria-labelledby="snd-template-label"
          className={["snd-trigger", menu.open && "snd-trigger--open"].filter(Boolean).join(" ")}
          onClick={menu.toggle}
        >
          {template ? (
            <TemplateSummary template={template} />
          ) : (
            <span className="snd-trigger-empty">{t("CSKH:Send:NoTemplatePicked")}</span>
          )}
          {template && <TemplateStatusBadge status={template.status} />}
          <DownOutlined className="snd-trigger-chevron" aria-hidden="true" />
        </button>
        {menu.open && (
          <SendTemplateMenu
            templates={templates}
            selectedId={template?.id ?? null}
            channelName={channelName}
            listPath={listPath}
            onPick={handlePick}
          />
        )}
      </div>
    </EditorCard>
  );
}
