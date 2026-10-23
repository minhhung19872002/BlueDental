import { useState } from "react";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import { useInboxTemplates } from "../../api/inboxApi";
import { ZnsTemplateDialog } from "./ZnsTemplateDialog";

/** BA P2210: "Hiển thị 3 cái template mới nhất". */
const CHIPS = 3;

interface Props {
  pickedId: string | null;
  disabled: boolean;
  onPick: (templateId: string) => void;
}

/** The ZNS row over the composer: the newest three templates, "Xem thêm" for the rest. */
export function ZnsTemplateBar({ pickedId, disabled, onPick }: Props) {
  const templates = useInboxTemplates();
  const [moreOpen, setMoreOpen] = useState(false);
  const all = templates.data ?? [];

  if (!templates.isLoading && all.length === 0) {
    return <p className="ibx-zns-none">{t("CSKH:Inbox:Zns:None")}</p>;
  }

  return (
    <div className="ibx-zns-bar" role="group" aria-label={t("CSKH:Inbox:Zns:Label")}>
      {all.slice(0, CHIPS).map((template) => (
        <button
          key={template.id}
          type="button"
          disabled={disabled}
          aria-pressed={template.id === pickedId}
          className={["ibx-zns-chip", template.id === pickedId && "ibx-zns-chip--on"].filter(Boolean).join(" ")}
          onClick={() => onPick(template.id)}
        >
          {t("CSKH:Inbox:Zns:Chip", template.name)}
        </button>
      ))}
      <Button size="small" type="link" disabled={disabled} onClick={() => setMoreOpen(true)}>
        {t("CSKH:Inbox:Zns:More")}
      </Button>
      <ZnsTemplateDialog
        open={moreOpen}
        templates={all}
        pickedId={pickedId}
        onPick={(id) => {
          onPick(id);
          setMoreOpen(false);
        }}
        onClose={() => setMoreOpen(false)}
      />
    </div>
  );
}
