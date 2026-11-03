import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { laboDueTag, type LaboDueTag } from "@/features/labo/api/laboStatus";

const shortDate = (value: string | undefined) => (value ? dayjs(value).format("DD/MM") : "—");

function dueTagText(tag: LaboDueTag): string {
  switch (tag.kind) {
    case "left":
      return t("Labo:Due:Left", tag.days);
    case "late":
      return t("Labo:Due:Late", tag.days);
    case "delivered":
      return t("Labo:Due:Delivered", shortDate(tag.date));
  }
}

/**
 * "Gửi → Hẹn giao": `29/10 → 03/11`, and under it "còn 5 ngày" while at the
 * Labo, red "Trễ 32 ngày" once past due, "đã giao 29/10" once delivered.
 */
export function LaboSendDueCell({ order }: { order: LaboOrderDto }) {
  const tag = laboDueTag(order);
  return (
    <div className="pd-labo-cell">
      <span>
        {shortDate(order.sentAt)} → {shortDate(order.dueAt)}
      </span>
      {tag && <span className={`pd-labo-due pd-labo-due--${tag.kind}`}>{dueTagText(tag)}</span>}
    </div>
  );
}
