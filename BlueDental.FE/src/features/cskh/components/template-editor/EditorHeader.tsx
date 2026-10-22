import { Link } from "react-router-dom";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import type { SaveKind } from "../../hooks/useTemplateEditor";

interface EditorHeaderProps {
  isNew: boolean;
  listPath: string;
  /** Without the create/update grant the editor is read-only and has no buttons. */
  canSave: boolean;
  pending: SaveKind | null;
  onSave: (kind: SaveKind) => void;
}

/** "Mẫu tin nhắn / Tạo mẫu mới" on the left, Lưu nháp · Lưu mẫu on the right (BA img_08). */
export function EditorHeader({ isNew, listPath, canSave, pending, onSave }: EditorHeaderProps) {
  const busy = pending !== null;
  const actions = canSave && (
    <>
      <Button disabled={busy} loading={pending === "draft"} onClick={() => onSave("draft")}>
        {t("CSKH:Template:SaveDraft")}
      </Button>
      <Button type="primary" disabled={busy} loading={pending === "publish"} onClick={() => onSave("publish")}>
        {t("CSKH:Template:Save")}
      </Button>
    </>
  );

  return (
    <div className="tpe-head">
      <nav className="tpe-crumbs" aria-label={t("CSKH:Template:Breadcrumb")}>
        <Link className="tpe-crumb" to={listPath}>
          {t("CSKH:Template:Breadcrumb")}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{isNew ? t("CSKH:Template:NewTitle") : t("CSKH:Template:EditTitle")}</span>
      </nav>
      <PageHeader
        title={isNew ? t("CSKH:Template:NewPageTitle") : t("CSKH:Template:EditPageTitle")}
        actions={actions}
      />
    </div>
  );
}
