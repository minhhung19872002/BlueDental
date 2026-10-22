import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAbility } from "@/hooks/useAbility";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import {
  MESSAGE_CHANNEL,
  useMessageVariables,
  useZnsTemplate,
  type MessageChannel,
  type MessageTemplateDto,
} from "../../api/templateApi";
import { useCaretField } from "../../hooks/useCaretField";
import { useEditorPreview } from "../../hooks/useEditorPreview";
import {
  formOf,
  hasComposed,
  useNavigateWhenClean,
  useSaveTemplate,
  useTemplateForm,
  type SaveKind,
  type TemplateForm,
} from "../../hooks/useTemplateEditor";
import { useVariableInsert } from "../../hooks/useVariableInsert";
import { findVariables } from "../../messageVariables";
import { templateEditorPath, TEMPLATE_LIST_PATH } from "../../templatePaths";
import { ChannelPicker } from "./ChannelPicker";
import { ChannelRules } from "./ChannelRules";
import { ComposeStep } from "./ComposeStep";
import { EditorHeader } from "./EditorHeader";
import { TemplateMetaCard } from "./TemplateMetaCard";
import { TemplatePreviewPanel } from "./TemplatePreviewPanel";
import { VariableLibrary } from "./VariableLibrary";

interface TemplateEditorProps {
  /** Undefined on "Tạo mẫu mới". */
  id: string | undefined;
  initial: TemplateForm;
}

/** Tạo / Sửa mẫu tin nhắn (BA img_08): the two steps on the left, variables and preview on the right. */
export function TemplateEditor({ id, initial }: TemplateEditorProps) {
  const branchId = useCurrentBranchId();
  const ability = useAbility("cskhTemplate");
  const canSave = id ? ability.canUpdate : ability.canCreate;
  const readOnly = !canSave;

  const editor = useTemplateForm(initial);
  const { form, update } = editor;
  const guard = useUnsavedChangesGuard(editor.dirty);
  const navigateWhenClean = useNavigateWhenClean(editor.dirty);
  const listPath = withBranch(TEMPLATE_LIST_PATH, branchId);

  // Lưu mẫu goes back to the list; Lưu nháp stays, on the template's own URL once it has one.
  const handleSaved = (saved: MessageTemplateDto, kind: SaveKind) => {
    editor.reset(formOf(saved));
    toast.success(t(kind === "publish" ? "CSKH:Template:Saved" : "CSKH:Template:SavedDraft"));
    if (kind === "publish" || !ability.canUpdate) navigateWhenClean(listPath);
    else if (!id) navigateWhenClean(withBranch(templateEditorPath(saved.id), branchId), true);
  };
  const saver = useSaveTemplate(id, form, handleSaved);

  const variables = useMessageVariables().data ?? [];
  const zns = useZnsTemplate(form.channel === MESSAGE_CHANNEL.Zalo ? form.externalTemplateId : null);
  const content = useCaretField(form.content, (value) => update("content", value));
  const subject = useCaretField(form.subject, (value) => update("subject", value));
  const inserter = useVariableInsert(
    form,
    (paramMap) => update("paramMap", paramMap),
    { content, subject },
    zns.data?.params ?? [],
  );
  const preview = useEditorPreview(form);
  const inUse = findVariables(form.content, form.subject, ...Object.values(form.paramMap));

  const [pendingChannel, setPendingChannel] = useState<MessageChannel | null>(null);
  const handleChannelChange = (channel: MessageChannel) => {
    if (channel === form.channel) return;
    if (hasComposed(form)) setPendingChannel(channel);
    else editor.switchChannel(channel);
  };
  const handleChannelConfirm = () => {
    if (pendingChannel !== null) editor.switchChannel(pendingChannel);
    setPendingChannel(null);
  };

  return (
    <div className="page-container tpe-page">
      <EditorHeader isNew={!id} listPath={listPath} canSave={canSave} pending={saver.pending} onSave={saver.save} />
      <div className="tpe-layout">
        <div className="tpe-main">
          <ChannelPicker channel={form.channel} locked={!!id || readOnly} onChange={handleChannelChange} />
          <TemplateMetaCard
            name={form.name}
            purpose={form.purpose}
            readOnly={readOnly}
            onNameChange={(name) => update("name", name)}
            onPurposeChange={(purpose) => update("purpose", purpose)}
          />
          <ComposeStep
            form={form}
            readOnly={readOnly}
            variables={variables}
            inUse={inUse}
            fields={{ content, subject }}
            inserter={inserter}
            preview={preview.preview}
            onChange={update}
            onDropVariable={editor.dropVariable}
          />
        </div>
        <aside className="tpe-side">
          <VariableLibrary
            variables={variables}
            usedKeys={new Set(inUse)}
            disabled={readOnly || !inserter.canInsert}
            onInsert={inserter.insert}
          />
          <TemplatePreviewPanel
            channel={form.channel}
            customer={preview.customer}
            preview={preview.preview}
            changing={preview.changing}
            onChangeCustomer={preview.changeCustomer}
          />
          <ChannelRules channel={form.channel} />
        </aside>
      </div>
      <ConfirmDialog
        open={pendingChannel !== null}
        title={t("CSKH:Template:ChangeChannelTitle")}
        message={t("CSKH:Template:ChangeChannelBody")}
        onConfirm={handleChannelConfirm}
        onClose={() => setPendingChannel(null)}
      />
      <ConfirmDialog
        open={guard.isBlocked}
        title={t("CSKH:Template:LeaveTitle")}
        message={t("CSKH:Template:LeaveBody")}
        confirmLabel={t("CSKH:Template:Leave")}
        cancelLabel={t("CSKH:Template:Stay")}
        onConfirm={guard.proceed}
        onClose={guard.stay}
      />
    </div>
  );
}
