import type { ReactNode } from "react";
import { Button, Spin, Table, Tooltip } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { EditOutlined, EyeOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { TREATMENT_STATUS, type PatientListItem, type TreatmentStatusCode } from "../types/patient";

interface Props {
  rows: PatientListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** Distinguishes "no patients yet" from "nothing matched the filters". */
  narrowed: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit: (row: PatientListItem) => void;
}

/** Trạng thái: the four derived states, collapsed onto the three the UI shows. */
const STATUS_STYLE: Record<TreatmentStatusCode, string> = {
  [TREATMENT_STATUS.None]: "bd-patient-status--pending",
  [TREATMENT_STATUS.Created]: "bd-patient-status--pending",
  [TREATMENT_STATUS.InProgress]: "bd-patient-status--active",
  [TREATMENT_STATUS.Done]: "bd-patient-status--done",
};

function statusLabel(status: TreatmentStatusCode): string {
  if (status === TREATMENT_STATUS.InProgress) return t("Đang điều trị");
  if (status === TREATMENT_STATUS.Done) return t("Hoàn tất");
  return t("Chưa phát sinh");
}

/** Every blank cell in the reference is an em dash in the muted text colour. */
function Dash() {
  return <span className="bd-patient-dim">—</span>;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="bd-patient-dim">{children}</span>;
}

/** Dịch vụ and Bác sĩ: two lines of a comma list, the rest behind the tooltip. */
function NameList({ names }: { names: string[] }) {
  if (names.length === 0) return <Dash />;

  const text = names.join(", ");
  return (
    <span className="bd-patient-list" title={text}>
      {text}
    </span>
  );
}

/**
 * The thirteen columns of the patient list, in the reference's order and
 * widths. Presentational: it takes rows and reports clicks, and knows nothing
 * about how the rows were fetched.
 */
export function PatientTable({
  rows,
  totalCount,
  page,
  pageSize,
  loading,
  narrowed,
  onPageChange,
  onPageSizeChange,
  onEdit,
}: Props) {
  const columns: ColumnsType<PatientListItem> = [
    {
      key: "creationTime",
      title: t("Ngày tạo hồ sơ"),
      width: 150,
      render: (_, row) => <Muted>{formatDate(row.creationTime)}</Muted>,
    },
    {
      key: "fullName",
      title: t("Họ và tên"),
      width: 260,
      render: (_, row) => (
        <Link className="bd-patient-name" to={`/patient/${row.id}`} title={row.fullName}>
          [{row.patientCode}] – {row.fullName}
        </Link>
      ),
    },
    {
      key: "dateOfBirth",
      title: t("Ngày sinh"),
      width: 130,
      render: (_, row) => (row.dateOfBirth ? <Muted>{formatDate(row.dateOfBirth)}</Muted> : <Dash />),
    },
    {
      key: "phoneNumber",
      title: t("Số điện thoại"),
      width: 140,
      render: (_, row) => row.phoneNumber || <Dash />,
    },
    {
      key: "treatmentStatus",
      title: t("Trạng thái"),
      width: 150,
      render: (_, row) => (
        <span className={`bd-patient-status ${STATUS_STYLE[row.treatmentStatus]}`}>
          {statusLabel(row.treatmentStatus)}
        </span>
      ),
    },
    {
      key: "serviceNames",
      title: t("Dịch vụ"),
      width: 180,
      render: (_, row) => <NameList names={row.serviceNames} />,
    },
    {
      key: "staffNames",
      title: t("Bác sĩ"),
      width: 180,
      render: (_, row) => <NameList names={row.staffNames} />,
    },
    {
      key: "totalAmount",
      title: t("Số tiền"),
      width: 170,
      align: "right",
      render: (_, row) => <span className="bd-patient-money">{formatVND(row.totalAmount)}</span>,
    },
    {
      key: "totalRevenue",
      title: t("Thực thu"),
      width: 140,
      align: "right",
      render: (_, row) => (
        <span className={`bd-patient-money${row.totalRevenue > 0 ? " bd-patient-money--in" : ""}`}>
          {formatVND(row.totalRevenue)}
        </span>
      ),
    },
    {
      key: "totalDebt",
      title: t("Công nợ"),
      width: 140,
      align: "right",
      render: (_, row) => (
        <span className={`bd-patient-money${row.totalDebt > 0 ? " bd-patient-money--due" : ""}`}>
          {formatVND(row.totalDebt)}
        </span>
      ),
    },
    {
      key: "nextAppointmentAt",
      title: t("Lịch hẹn gần nhất"),
      width: 170,
      render: (_, row) =>
        row.nextAppointmentAt ? formatDateTime(row.nextAppointmentAt) : <Dash />,
    },
    {
      key: "lastVisitAt",
      title: t("Lần khám cuối"),
      width: 150,
      render: (_, row) => (row.lastVisitAt ? formatDateTime(row.lastVisitAt) : <Dash />),
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 90,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <div className="bd-patient-rowactions">
          <Tooltip title={t("Xem")}>
            <Link to={`/patient/${row.id}`} aria-label={t("Xem {0}", row.fullName)}>
              <Button type="text" size="small" icon={<EyeOutlined />} />
            </Link>
          </Tooltip>

          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t("Chỉnh sửa {0}", row.fullName)}
              onClick={() => onEdit(row)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total: totalCount,
    showSizeChanger: true,
    pageSizeOptions: [5, 10, 20, 25, 50, 100],
    // The reference names both halves of the pager rather than using arrows
    // alone, and counts in patients rather than rows.
    itemRender: (_, type, element) => {
      if (type === "prev") return <Button size="small" icon={<LeftOutlined />}>{t("Trước")}</Button>;
      if (type === "next") return <Button size="small">{t("Sau")}<RightOutlined /></Button>;
      return element;
    },
    showTotal: (total, range) => (
      <span className="bd-patient-pager-count">
        {t("Hiển thị")} <b>{total === 0 ? 0 : range[0]}</b>–<b>{range[1]}</b> {t("trên")}{" "}
        <b>{total}</b> {t("bệnh nhân")}
      </span>
    ),
    onChange: (nextPage, nextSize) => {
      if (nextSize !== pageSize) onPageSizeChange(nextSize);
      else onPageChange(nextPage);
    },
  };

  return (
    <div className="bd-patient-tablecard">
      {loading && (
        <div className="bd-patient-loading" role="status" aria-live="polite">
          <Spin size="large" />
        </div>
      )}

      <Table<PatientListItem>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={pagination}
        scroll={{ x: "max-content" }}
        locale={{
          emptyText: (
            <div className="bd-patient-empty">
              {narrowed ? t("Không có bệnh nhân phù hợp") : t("Chưa có hồ sơ bệnh nhân nào")}
            </div>
          ),
        }}
      />
    </div>
  );
}
