import { useNavigate, useParams } from "react-router-dom";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentBranchId, withBranch } from "@/lib/clinicBranch";
import { describeApiError } from "@/lib/apiError";
import { useMessageTemplate } from "../api/templateApi";
import { TemplateEditor } from "../components/template-editor/TemplateEditor";
import { EMPTY_TEMPLATE_FORM, formOf } from "../hooks/useTemplateEditor";
import { TEMPLATE_LIST_PATH } from "../templatePaths";
import "../components/cskh-template.css";
import "../components/cskh-template-editor.css";

/** /cskh-grouping/templates/new and /cskh-grouping/templates/:id. */
export function MessageTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const template = useMessageTemplate(id);

  if (!id) return <TemplateEditor key="new" id={undefined} initial={EMPTY_TEMPLATE_FORM} />;

  if (template.isLoading) {
    return (
      <div className="page-container tpe-page tpe-page--center">
        <Spin size="large" />
      </div>
    );
  }
  if (!template.data) {
    // Another branch's template reads as not found, like any missing one.
    const refusal = template.isError ? describeApiError(template.error).message : null;
    return (
      <div className="page-container tpe-page">
        <EmptyState
          title={refusal ?? t("CSKH:Template:NotFound")}
          actionLabel={t("CSKH:Template:BackToList")}
          onAction={() => navigate(withBranch(TEMPLATE_LIST_PATH, branchId))}
        />
      </div>
    );
  }

  return <TemplateEditor key={id} id={id} initial={formOf(template.data)} />;
}
