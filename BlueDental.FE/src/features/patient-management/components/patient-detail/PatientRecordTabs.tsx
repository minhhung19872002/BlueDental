import { useState } from "react";
import { Button, Space, type TableColumnsType } from "antd";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import { DataTable } from "@/components/DataTable";
import {
  invoiceStatusConfig,
  usePatientInvoices,
  type InvoiceDto,
  type InvoiceStatus,
} from "@/features/billing/api";
import { PaymentModal } from "@/features/billing/components/PaymentModal";
import {
  CARE_OUTCOME,
  CARE_TYPE,
  careStatusLabels,
  careTypeLabels,
  useCareRecordList,
  type CareRecordDto,
  type CareStatus,
  type CareType,
} from "@/features/cskh/api/careApi";
import {
  LABO_ORDER_KIND,
  usePatientLaboOrders,
  type LaboOrderDto,
} from "@/features/labo/api/laboApi";
import { PrescriptionPanel } from "@/features/treatment-management/components/PrescriptionPanel";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate, formatVND } from "@/utils/format";
import type { PatientDto } from "../../types/patient";
import { PatientCareDialog, PatientLaboDialog } from "./PatientRecordDialogs";

export function PatientLaboTab({ patient }: { patient: PatientDto }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LaboOrderDto | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const query = usePatientLaboOrders(patient.id);
  const pagination = useTablePagination(20);
  const rows = query.data ?? [];
  const filters = [
    ["Đơn hàng mới", rows.filter((item) => item.kind === LABO_ORDER_KIND.New).length, "green"],
    [
      "Tiếp tục công đoạn",
      rows.filter((item) => item.kind === LABO_ORDER_KIND.ContinueStage).length,
      "amber",
    ],
    ["Bảo hành", rows.filter((item) => item.kind === LABO_ORDER_KIND.Guarantee).length, "red"],
  ] as const;
  const visibleRows = filter === null ? rows : rows.filter((item) => item.kind === filter);
  const columns: TableColumnsType<LaboOrderDto> = [
    { title: t("Mã phiếu labo"), dataIndex: "orderCode", width: 125 },
    {
      title: t("Ngày gửi / Tình trạng mẫu"),
      dataIndex: "sentAt",
      width: 175,
      render: (value: string | undefined) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Ngày giao / Trạng thái Labo"),
      dataIndex: "receivedAt",
      width: 185,
      render: (value: string | undefined) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Bác sĩ chỉ định"),
      dataIndex: "dentistName",
      width: 150,
      render: (value: string | undefined) => value ?? "—",
    },
    { title: t("Nhà cung cấp"), dataIndex: "labProviderName", width: 145 },
    {
      title: t("Vật liệu"),
      dataIndex: "materialName",
      width: 130,
      render: (value: string | undefined) => value ?? "—",
    },
    {
      title: t("Số răng"),
      dataIndex: "toothNumbers",
      width: 90,
      render: (value: string | undefined) => value ?? "—",
    },
    { title: t("Số lượng"), width: 80, align: "center", render: () => 1 },
    {
      title: t("File Labo gửi về"),
      dataIndex: "attachmentUrl",
      width: 145,
      render: (value: string | undefined) => (value ? <a href={value}>{t("Xem file")}</a> : "—"),
    },
    {
      title: t("Thao tác"),
      width: 85,
      fixed: "right",
      render: (_, row) => (
        <Button
          type="text"
          icon={<EditOutlined />}
          aria-label={t("Chỉnh sửa phiếu Labo")}
          onClick={() => setEditing(row)}
        />
      ),
    },
  ];
  return (
    <section className="pd-pane pd-pane--fill">
      <div className="pd-record-toolbar">
        <div className="pd-counter-row">
          {filters.map(([label, count, tone], index) => {
            const kind = [
              LABO_ORDER_KIND.New,
              LABO_ORDER_KIND.ContinueStage,
              LABO_ORDER_KIND.Guarantee,
            ][index];
            return (
              <button
                type="button"
                className={`pd-counter pd-counter--${tone}${filter === kind ? " active" : ""}`}
                key={label}
                onClick={() => setFilter((current) => (current === kind ? null : kind))}
              >
                <b>{count}</b>
                {t(label)}
              </button>
            );
          })}
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialogOpen(true)}>
          {t("Tạo phiếu Labo")}
        </Button>
      </div>
      <div className="bd-cat-card">
        <DataTable<LaboOrderDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={visibleRows.slice(
            pagination.skipCount,
            pagination.skipCount + pagination.pageSize,
          )}
          locale={{ emptyText: t("Không có dữ liệu") }}
          pagination={pagination.buildConfig(visibleRows.length, countedTotal(t("phiếu labo")))}
        />
      </div>
      <PatientLaboDialog
        open={dialogOpen || Boolean(editing)}
        patient={patient}
        order={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </section>
  );
}

export function PatientPrescriptionTab({ patient }: { patient: PatientDto }) {
  return (
    <section className="pd-pane pd-pane--fill">
      <PrescriptionPanel
        patientId={patient.id}
        compact
        patientLabel={`[${patient.patientCode}] - ${patient.fullName}`}
        patientPhone={patient.phoneNumber}
      />
    </section>
  );
}

export function PatientCareTab({ patient }: { patient: PatientDto }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CareRecordDto | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const query = useCareRecordList({ patientId: patient.id, maxResultCount: 200 });
  const pagination = useTablePagination(20);
  const rows = query.data?.items ?? [];
  const counters = [
    ["Đã chăm sóc", rows.filter((item) => item.status !== 1).length],
    ["Tốt", rows.filter((item) => item.outcome === CARE_OUTCOME.Good).length],
    ["Khá", rows.filter((item) => item.outcome === CARE_OUTCOME.Fair).length],
    ["Bình thường", rows.filter((item) => item.outcome === CARE_OUTCOME.Normal).length],
    ["Khiếu nại", rows.filter((item) => item.outcome === CARE_OUTCOME.Complaint).length],
    ["Đặc biệt", rows.filter((item) => item.type === CARE_TYPE.Special).length],
    ["Định kỳ", rows.filter((item) => item.type === CARE_TYPE.Periodic).length],
    ["Cơ bản", rows.filter((item) => item.type === CARE_TYPE.Base).length],
  ] as const;
  const visibleRows = rows.filter((item) => {
    if (!filter) return true;
    if (filter === "cared") return item.status !== 1;
    if (filter === "special") return item.type === CARE_TYPE.Special;
    if (filter === "periodic") return item.type === CARE_TYPE.Periodic;
    if (filter === "base") return item.type === CARE_TYPE.Base;
    return item.outcome === Number(filter);
  });
  const columns: TableColumnsType<CareRecordDto> = [
    {
      title: t("Ngày chăm sóc"),
      dataIndex: "dueAt",
      width: 130,
      render: (value: string | null, row) => formatDate(value ?? row.creationTime),
    },
    {
      title: t("Trạng thái CSKH"),
      dataIndex: "status",
      width: 145,
      render: (value: CareStatus) => careStatusLabels()[value],
    },
    {
      title: t("Nhóm"),
      dataIndex: "type",
      width: 150,
      render: (value: CareType) => careTypeLabels()[value],
    },
    {
      title: t("Dịch vụ"),
      dataIndex: "serviceNames",
      width: 170,
      render: (value: string[]) => value.join(", ") || "—",
    },
    {
      title: t("Nội dung"),
      dataIndex: "description",
      render: (value: string | null, row) => value ?? row.subject,
    },
    {
      title: t("Bác sĩ điều trị"),
      dataIndex: "assignedStaffName",
      width: 145,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Nhân viên chăm sóc"),
      dataIndex: "careStaffName",
      width: 155,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Đánh giá"),
      dataIndex: "resolution",
      width: 110,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Thao tác"),
      width: 90,
      fixed: "right",
      render: (_, row) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={t("Chỉnh sửa chăm sóc")}
            onClick={() => setEditing(row)}
          />
        </Space>
      ),
    },
  ];
  return (
    <section className="pd-pane pd-pane--fill">
      <div className="pd-record-toolbar">
        <div className="pd-counter-row pd-counter-row--care">
          {counters.map(([label, count], index) => {
            const keys = [
              "cared",
              String(CARE_OUTCOME.Good),
              String(CARE_OUTCOME.Fair),
              String(CARE_OUTCOME.Normal),
              String(CARE_OUTCOME.Complaint),
              "special",
              "periodic",
              "base",
            ];
            const key = keys[index];
            return (
              <button
                type="button"
                className={`pd-counter${filter === key ? " active" : ""}`}
                key={label}
                onClick={() => setFilter((current) => (current === key ? null : key))}
              >
                <b>{count}</b>
                {t(label)}
              </button>
            );
          })}
        </div>
        <Button type="primary" onClick={() => setDialogOpen(true)}>
          {t("CSKH đặc biệt")}
        </Button>
      </div>
      <div className="bd-cat-card">
        <DataTable<CareRecordDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={visibleRows.slice(
            pagination.skipCount,
            pagination.skipCount + pagination.pageSize,
          )}
          locale={{ emptyText: t("Chưa có dữ liệu chăm sóc") }}
          pagination={pagination.buildConfig(visibleRows.length, countedTotal(t("nhật ký")))}
        />
      </div>
      <PatientCareDialog
        open={dialogOpen || Boolean(editing)}
        patient={patient}
        record={editing}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </section>
  );
}

export function PatientInvoiceTab({ patientId }: { patientId: string }) {
  const query = usePatientInvoices(patientId);
  const [selected, setSelected] = useState<InvoiceDto | null>(null);
  const pagination = useTablePagination(20);
  const rows = query.data ?? [];
  const columns: TableColumnsType<InvoiceDto> = [
    { title: t("Mã hóa đơn"), dataIndex: "invoiceNumber", width: 140 },
    { title: t("Ngày tạo"), dataIndex: "issuedAt", width: 125, render: formatDate },
    {
      title: t("Tổng tiền"),
      dataIndex: "totalAmount",
      width: 135,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Đã thanh toán"),
      dataIndex: "paidAmount",
      width: 145,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Còn lại"),
      dataIndex: "balanceDue",
      width: 135,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      width: 140,
      render: (value: InvoiceStatus) => {
        const config = invoiceStatusConfig()[value];
        return <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>;
      },
    },
    {
      title: t("Thao tác"),
      width: 110,
      fixed: "right",
      render: (_, row) => (
        <Button type="link" disabled={row.balanceDue <= 0} onClick={() => setSelected(row)}>
          {t("Thu tiền")}
        </Button>
      ),
    },
  ];
  return (
    <section className="pd-pane pd-pane--fill">
      <div className="bd-cat-card">
        <DataTable<InvoiceDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Chưa có hóa đơn") }}
          pagination={pagination.buildConfig(rows.length, countedTotal(t("hóa đơn")))}
        />
      </div>
      <PaymentModal open={Boolean(selected)} invoice={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
