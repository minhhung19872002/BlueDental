import { useMemo, useState } from "react";
import { Empty, Input, Modal } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";
import { formatDate } from "@/utils/format";
import type { InboxTemplate } from "../../api/inboxApi";
import { CARE_TABS } from "../../careTabs";

interface Props {
  open: boolean;
  templates: InboxTemplate[];
  pickedId: string | null;
  onPick: (templateId: string) => void;
  onClose: () => void;
}

function purposeLabel(template: InboxTemplate): string | null {
  return CARE_TABS.find((tab) => tab.type === template.purpose)?.label() ?? null;
}

/** "Xem thêm" (BA P2210: "pop-up rùi liệt kê danh sách ZNS template"): every ready template, newest first, searchable. */
export function ZnsTemplateDialog({ open, templates, pickedId, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const wanted = foldForSearch(query.trim());
    return wanted ? templates.filter((item) => foldForSearch(item.name).includes(wanted)) : templates;
  }, [templates, query]);

  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{t("CSKH:Inbox:Zns:DialogTitle")}</h2>}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnHidden
      className="app-dialog"
    >
      <Input
        type="search"
        allowClear
        autoFocus
        prefix={<SearchOutlined />}
        placeholder={t("CSKH:Inbox:Zns:Search")}
        aria-label={t("CSKH:Inbox:Zns:Search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length === 0 ? (
        <Empty className="ibx-zns-empty" description={t("CSKH:Inbox:Zns:NoMatch")} />
      ) : (
        <ul className="ibx-zns-list" aria-label={t("CSKH:Inbox:Zns:DialogTitle")}>
          {shown.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                aria-pressed={template.id === pickedId}
                className={["ibx-zns-item", template.id === pickedId && "ibx-zns-item--on"].filter(Boolean).join(" ")}
                onClick={() => onPick(template.id)}
              >
                <span className="ibx-zns-item-name">{template.name}</span>
                <span className="ibx-zns-item-meta">
                  {[purposeLabel(template), template.externalTemplateId && `ZNS #${template.externalTemplateId}`, formatDate(template.creationTime)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
