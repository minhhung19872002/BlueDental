import { t } from "@/lib/i18n";

interface Props {
  open: number;
  done: number;
}

/** "Yêu cầu bảo hành" at the right of the history (m371), without Lượt đã dùng (D5). */
export function WarrantyRequestPanel({ open, done }: Props) {
  const stats = [
    { key: "open", value: open, label: t("Treatment:Warranty:Request:Open") },
    { key: "done", value: done, label: t("Treatment:Warranty:Request:Done") },
  ];
  return (
    <aside className="pwt-requests" aria-labelledby="pwt-requests-title">
      <h3 id="pwt-requests-title" className="pwt-requests-title">
        {t("Treatment:Warranty:History:Filter:Request")}
      </h3>
      <div className="pwt-request-stats">
        {stats.map((stat) => (
          <div key={stat.key} className="pwt-request-stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      {open + done === 0 && <p className="pwt-request-note">{t("Treatment:Warranty:Request:Empty")}</p>}
    </aside>
  );
}
