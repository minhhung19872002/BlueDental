import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/i18n";
import { LABO_STATUS_CONFIG, type LaboStatus } from "@/features/labo/api/laboApi";
import type { LaboOrderFacts } from "./laboOrderFacts";

interface BlockProps {
  title: string;
  rows: [label: string, value: string][];
  children?: ReactNode;
}

/** One titled block of label/value rows, the modal's four quarters. */
function Block({ title, rows, children }: BlockProps) {
  return (
    <section className="pd-labo-detail-block">
      <h3>{title}</h3>
      <div className="pd-labo-detail-rows">
        {rows.map(([label, value]) => (
          <div className="pd-labo-detail-row" key={label}>
            <span>{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
      {children}
    </section>
  );
}

/** The status pill under the fourth block, in the same tone as the table's. */
function StatusPill({ status }: { status: LaboStatus }) {
  const tone = LABO_STATUS_CONFIG[status];
  return (
    <span
      className="pd-labo-detail-pill"
      style={{ "--pill-bg": tone.bg, "--pill-color": tone.color } as CSSProperties}
    >
      {t(tone.label)}
    </span>
  );
}

interface Props {
  facts: LaboOrderFacts;
  status: LaboStatus;
}

/**
 * The read-only body of "Thông tin chung": two columns of two blocks each,
 * measured on the reference (docs/clone/pages/patient-detail.md, Tab 6).
 */
export function LaboDetailFacts({ facts, status }: Props) {
  return (
    <div className="pd-labo-detail">
      <Block
        title={t("Thông tin chung")}
        rows={[
          [t("Bác sĩ chỉ định"), facts.dentist],
          [t("Khách hàng"), facts.customer],
          [t("Ngày sinh"), facts.birthDate],
        ]}
      />
      <Block
        title={t("Thông tin labo")}
        rows={[
          [t("Nhà cung cấp"), facts.supplier],
          [t("Ngày gửi"), facts.sentAt],
          [t("Ngày nhận dự kiến"), facts.dueDate],
        ]}
      />
      <Block
        title={t("Thông số labo")}
        rows={[
          [t("Vật liệu"), facts.material],
          [t("Đường hoàn tất"), facts.finishLine],
          [t("Khớp cắn"), facts.bite],
          [t("Kiểu nhịp"), facts.rhythm],
          [t("Chỉ định"), facts.instruction],
        ]}
      />
      <Block
        title={t("Chi tiết phiếu")}
        rows={[
          [t("Dịch vụ điều trị"), facts.treatmentService],
          [t("Loại phục hình"), facts.laboService],
          [t("Răng"), facts.teeth],
          [t("Màu chi tiết"), facts.shade],
          [t("Số lượng"), facts.quantity],
        ]}
      >
        <h3>{t("Trạng thái")}</h3>
        <StatusPill status={status} />
      </Block>
    </div>
  );
}
