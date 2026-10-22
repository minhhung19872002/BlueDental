import { t } from "@/lib/i18n";
import { channelLabels, MESSAGE_CHANNEL, type MessagePreview, type MessageVariable } from "../../api/templateApi";
import type { CaretField } from "../../hooks/useCaretField";
import type { TemplateForm } from "../../hooks/useTemplateEditor";
import type { VariableInserter } from "../../hooks/useVariableInsert";
import { CommonVariableChips } from "./CommonVariableChips";
import { ComposerFooter } from "./ComposerFooter";
import { ContentField } from "./ContentField";
import { EditorCard } from "./EditorCard";
import { SubjectField } from "./SubjectField";
import { VariablesInUse } from "./VariablesInUse";
import { ZaloTemplateSection } from "./ZaloTemplateSection";

interface ComposeStepProps {
  form: TemplateForm;
  readOnly: boolean;
  variables: readonly MessageVariable[];
  /** Every `{key}` in the content, subject and ZNS parameters. */
  inUse: readonly string[];
  fields: { content: CaretField; subject: CaretField };
  inserter: VariableInserter;
  preview: MessagePreview | undefined;
  onChange: <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => void;
  onDropVariable: (key: string) => void;
}

/** Bước 2 · Soạn nội dung: free text for SMS and Email, a ZNS template's parameters for Zalo. */
export function ComposeStep(props: ComposeStepProps) {
  const { form, readOnly, variables, inUse, fields, inserter, preview, onChange, onDropVariable } = props;
  const isZalo = form.channel === MESSAGE_CHANNEL.Zalo;

  const handleTemplateChange = (templateId: string | null) => {
    onChange("externalTemplateId", templateId);
    onChange("paramMap", {});
  };

  return (
    <EditorCard
      step={2}
      title={t("CSKH:Template:Step2")}
      extra={<span className="tpe-badge">{t("CSKH:Template:ChannelBadge", channelLabels()[form.channel])}</span>}
    >
      <CommonVariableChips variables={variables} disabled={readOnly || !inserter.canInsert} onInsert={inserter.insert} />
      {isZalo ? (
        <ZaloTemplateSection
          externalTemplateId={form.externalTemplateId}
          paramMap={form.paramMap}
          variables={variables}
          readOnly={readOnly}
          onTemplateChange={handleTemplateChange}
          onParamMapChange={(paramMap) => onChange("paramMap", paramMap)}
          onParamFocus={(name) => inserter.focusOn({ kind: "param", name })}
        />
      ) : (
        <>
          {form.channel === MESSAGE_CHANNEL.Email && (
            <SubjectField
              value={form.subject}
              field={fields.subject}
              readOnly={readOnly}
              onChange={(subject) => onChange("subject", subject)}
              onFocus={() => inserter.focusOn({ kind: "subject" })}
            />
          )}
          <ContentField
            value={form.content}
            field={fields.content}
            variables={variables}
            readOnly={readOnly}
            onChange={(content) => onChange("content", content)}
            onFocus={() => inserter.focusOn({ kind: "content" })}
          />
        </>
      )}
      <VariablesInUse keys={inUse} variables={variables} readOnly={readOnly} onRemove={onDropVariable} />
      {!isZalo && (
        <ComposerFooter
          channel={form.channel}
          preview={preview}
          removeDiacritics={form.removeDiacritics}
          readOnly={readOnly}
          onRemoveDiacriticsChange={(value) => onChange("removeDiacritics", value)}
        />
      )}
    </EditorCard>
  );
}
