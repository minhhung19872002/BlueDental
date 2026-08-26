import { Button, Popconfirm, Progress, Switch, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { VOUCHER_STATUS_CONFIG, type VoucherDto, type VoucherStatus } from "../api/voucherApi";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

function formatPublishedAt(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mm} ${dd}/${mo}/${d.getFullYear()}`;
}

interface VoucherTableHandlers {
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEdit: (row: VoucherDto) => void;
  onDelete: (id: string) => void;
  onShowServices: (row: VoucherDto) => void;
}

function DiscountCell({ row }: { row: VoucherDto }) {
  if (row.discountType === "percentage") {
    return <span className="voucher-discount">-{row.discountValue}%</span>;
  }
  return <span className="voucher-discount">-{formatVND(row.discountValue)}đ</span>;
}

function ConditionsCell({
  row,
  onShowServices,
}: {
  row: VoucherDto;
  onShowServices: (row: VoucherDto) => void;
}) {
  const hasTargets = row.targetIds.length > 0;
  const lines: string[] = [
    `- ${hasTargets ? t("Theo dịch vụ") : t("Không theo dịch vụ")}`,
  ];

  if (row.scopeTarget === "treatment" && row.minOrderValue) {
    lines.push(`- ${t("KHĐT")} >= ${formatVND(row.minOrderValue)} đ`);
  }

  lines.push(
    `- ${row.isExclusive ? t("Không kết hợp voucher khác") : t("Kết hợp với voucher khác")}`,
  );

  if (row.maxDiscountAmount) {
    lines.push(`- ${t("Giảm tối đa")} ${formatVND(row.maxDiscountAmount)} đ`);
  }

  return (
    <div className="voucher-conditions">
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      {hasTargets && (
        <a
          className="voucher-conditions-detail"
          onClick={() => onShowServices(row)}
        >
          {t("Xem chi tiết")}
        </a>
      )}
    </div>
  );
}

function UsageCell({ row }: { row: VoucherDto }) {
  const used = row.usedCount;
  const limit = row.usageLimit;
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="voucher-usage">
      <span>
        {used} / {limit ?? "∞"}
      </span>
      <Progress
        percent={pct}
        showInfo={false}
        size="small"
        strokeColor="var(--bd-blue)"
      />
    </div>
  );
}

function DisplayCell({
  row,
  onPublish,
  onUnpublish,
  onEdit,
}: {
  row: VoucherDto;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEdit: (row: VoucherDto) => void;
}) {
  if (row.status === "expired") {
    return (
      <div className="voucher-terminal-card voucher-terminal-card--expired">
        <strong>{t("Đã hết hạn")}</strong>
        <span>{t("Hạn cuối")}: {formatDate(row.endDate)}</span>
        <a className="voucher-reactivate-link" onClick={() => onEdit(row)}>
          {t("Sửa để kích hoạt lại")}
        </a>
      </div>
    );
  }

  if (row.status === "out_of_uses") {
    return (
      <div className="voucher-terminal-card voucher-terminal-card--exhausted">
        <strong>{t("Đã hết lượt")}</strong>
        <span>{row.usedCount} / {row.usageLimit ?? "∞"} {t("lượt")}</span>
        <a className="voucher-reactivate-link" onClick={() => onEdit(row)}>
          {t("Sửa để kích hoạt lại")}
        </a>
      </div>
    );
  }

  return (
    <div className="voucher-display-active">
      <div className="voucher-display-toggle-row">
        <Switch
          checked={row.isPublished}
          onChange={(checked) => {
            if (checked) onPublish(row.id);
            else onUnpublish(row.id);
          }}
          size="small"
        />
        <span className="voucher-display-label">
          {row.isPublished ? t("Đang hiển thị") : t("Đã ẩn")}
        </span>
      </div>
      {row.isPublished && row.publishedAt && (
        <span className="voucher-display-time">
          {formatPublishedAt(row.publishedAt)}
        </span>
      )}
    </div>
  );
}

export function buildVoucherColumns(handlers: VoucherTableHandlers): ColumnsType<VoucherDto> {
  return [
    {
      title: t("Mã / Tên Voucher"),
      key: "code",
      width: 200,
      render: (_, row) => (
        <div>
          {/* New rows store the full "HN-XXXX" code; legacy rows stored it
              bare with the prefix in its own column, so only join when the
              prefix is missing from the code itself. */}
          <div className="voucher-code">
            {row.prefix && !row.code.startsWith(`${row.prefix}-`)
              ? `${row.prefix}-${row.code}`
              : row.code}
          </div>
          <div className="text-muted text-xs">{row.name}</div>
        </div>
      ),
    },
    {
      title: t("Mức giảm"),
      key: "discount",
      width: 140,
      render: (_, row) => <DiscountCell row={row} />,
    },
    {
      title: t("Điều kiện áp dụng"),
      key: "conditions",
      width: 220,
      render: (_, row) => (
        <ConditionsCell row={row} onShowServices={handlers.onShowServices} />
      ),
    },
    {
      title: t("Thời hạn"),
      key: "validity",
      width: 200,
      render: (_, row) =>
        `${formatDate(row.startDate)} — ${formatDate(row.endDate)}`,
    },
    {
      title: t("Lượt dùng"),
      key: "usage",
      width: 130,
      render: (_, row) => <UsageCell row={row} />,
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "center",
      render: (status: VoucherStatus) => {
        const config = VOUCHER_STATUS_CONFIG[status];
        if (!config) return <Tag>{status}</Tag>;
        return <Tag color={config.color}>{config.label()}</Tag>;
      },
    },
    {
      title: t("Hiển thị"),
      key: "display",
      width: 200,
      render: (_, row) => (
        <DisplayCell
          row={row}
          onPublish={handlers.onPublish}
          onUnpublish={handlers.onUnpublish}
          onEdit={handlers.onEdit}
        />
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 100,
      align: "center",
      render: (_, row) => (
        <div className="voucher-actions">
          <Tooltip title={t("Sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handlers.onEdit(row)}
            />
          </Tooltip>
          <Popconfirm
            title={t("Xoá voucher này?")}
            okText={t("Xoá")}
            cancelText={t("Huỷ")}
            onConfirm={() => handlers.onDelete(row.id)}
          >
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];
}
