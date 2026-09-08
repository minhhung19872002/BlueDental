import { Button, Tooltip, type TableColumnsType } from "antd";
import { EyeOutlined, FolderFilled, PlusOutlined, SafetyOutlined } from "@ant-design/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  LABO_KIND_CONFIG,
  LABO_STATUS_CONFIG,
  type LaboOrderDto,
} from "@/features/labo/api/laboApi";

interface Actions {
  onDetail: (order: LaboOrderDto) => void;
  onContinue: (order: LaboOrderDto) => void;
  onWarranty: (order: LaboOrderDto) => void;
}

interface DatePillProps {
  date: string | undefined;
  pill: { label: string; bg: string; color: string };
}

const dash = (value: string | undefined) => value ?? "—";

/** A `DD/MM/YYYY HH:mm` line with the pill under it, as the reference stacks them. */
function DatePill({ date, pill }: DatePillProps) {
  return (
    <div className="pd-labo-cell">
      <span>{date ? formatDateTime(date) : "—"}</span>
      <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />
    </div>
  );
}

/**
 * The patient's Labo table. Ngày gửi carries the kind pill and Ngày giao the
 * status pill, File Labo is the folder the reference draws, and Thao tác
 * opens the read-only detail or raises the two child orders on the row through
 * the same icon buttons the other patient tables use.
 */
export function buildPatientLaboColumns({
  onDetail,
  onContinue,
  onWarranty,
}: Actions): TableColumnsType<LaboOrderDto> {
  return [
    {
      title: t("Mã phiếu labo"),
      dataIndex: "orderCode",
      width: 150,
      render: (value: string) => <span className="pd-labo-code">{value}</span>,
    },
    {
      title: t("Ngày gửi / Tình trạng mẫu"),
      dataIndex: "sentAt",
      width: 175,
      render: (value: string | undefined, row) => (
        <DatePill date={value} pill={LABO_KIND_CONFIG[row.kind]} />
      ),
    },
    {
      title: t("Ngày giao / Trạng thái Labo"),
      dataIndex: "receivedAt",
      width: 175,
      render: (value: string | undefined, row) => (
        <DatePill date={value} pill={LABO_STATUS_CONFIG[row.status]} />
      ),
    },
    { title: t("Bác sĩ chỉ định"), dataIndex: "dentistName", width: 140, render: dash },
    { title: t("Nhà cung cấp"), dataIndex: "labProviderName", width: 140, render: dash },
    { title: t("Vật liệu"), dataIndex: "materialName", render: dash },
    { title: t("Số răng"), dataIndex: "toothNumbers", width: 100, render: dash },
    { title: t("Số lượng"), dataIndex: "quantity", width: 100, align: "center" },
    {
      title: t("File Labo gửi về"),
      dataIndex: "attachmentUrl",
      width: 130,
      align: "center",
      render: (value: string | undefined) => (
        <Tooltip title={value ? t("Xem file") : t("Chưa có file")}>
          <Button
            type="text"
            className="pd-labo-file"
            icon={<FolderFilled />}
            href={value}
            target="_blank"
            rel="noreferrer"
            disabled={!value}
            aria-label={t("Xem file")}
          />
        </Tooltip>
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 130,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <span className="pd-icon-actions">
          <Tooltip title={t("Xem chi tiết")}>
            <Button
              type="text"
              className="pd-labo-act pd-labo-act--info"
              icon={<EyeOutlined />}
              aria-label={t("Xem chi tiết")}
              onClick={() => onDetail(row)}
            />
          </Tooltip>
          <Tooltip title={t("Tiếp tục công đoạn")}>
            <Button
              type="text"
              className="pd-labo-act pd-labo-act--primary"
              icon={<PlusOutlined />}
              aria-label={t("Tiếp tục công đoạn")}
              onClick={() => onContinue(row)}
            />
          </Tooltip>
          <Tooltip title={t("Bảo hành")}>
            <Button
              type="text"
              className="pd-labo-act pd-labo-act--success"
              icon={<SafetyOutlined />}
              aria-label={t("Bảo hành")}
              onClick={() => onWarranty(row)}
            />
          </Tooltip>
        </span>
      ),
    },
  ];
}
