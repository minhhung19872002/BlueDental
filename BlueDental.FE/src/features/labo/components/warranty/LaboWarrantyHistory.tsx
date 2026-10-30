import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { LaboOrderToothDto } from "@/features/labo/api/laboApi";

interface Props {
  tooth: LaboOrderToothDto;
  code: string;
}

interface Entry {
  key: string;
  at: string;
  title: string;
  tone: "active" | "passed";
}

/**
 * Lịch sử: what the BA asked to keep for now — Kiểm tra kết quả Labo = Đạt
 * and Kích hoạt bảo hành — newest first. Tiếp nhận bảo hành comes later.
 */
export function LaboWarrantyHistory({ tooth, code }: Props) {
  const entries: Entry[] = [];
  if (tooth.warrantyActivatedAt) {
    entries.push({
      key: "activated",
      at: tooth.warrantyActivatedAt,
      title: t("Labo:Warranty:History:Activated", code),
      tone: "active",
    });
  }
  if (tooth.passedAt) {
    entries.push({
      key: "passed",
      at: tooth.passedAt,
      title: t("Labo:Warranty:History:Passed", tooth.toothNumber),
      tone: "passed",
    });
  }
  if (entries.length === 0) return <p className="pd-labo-warranty-note">{t("Labo:Warranty:History:Empty")}</p>;

  return (
    <ol className="pd-labo-warranty-history">
      {entries.map((entry) => (
        <li key={entry.key} className={`pd-labo-warranty-history-item pd-labo-warranty-history-item--${entry.tone}`}>
          <strong>{entry.title}</strong>
          <span>{formatDateTime(entry.at)}</span>
        </li>
      ))}
    </ol>
  );
}
