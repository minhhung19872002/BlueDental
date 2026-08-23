import { Table, Tag, Empty, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { usePatientPrescriptions, type PrescriptionDto } from "../api";

interface Props {
  patientId: string;
}

export function PrescriptionForm({ patientId }: Props) {
  const { t } = useTranslation();

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    Active:    { color: "green",   label: t("treatment.prescriptionActive") },
    Expired:   { color: "default", label: t("treatment.prescriptionExpired") },
    Cancelled: { color: "red",     label: t("treatment.prescriptionCancelled") },
  };

  const COLUMNS: ColumnsType<PrescriptionDto> = [
    {
      title: t("treatment.medication"),
      dataIndex: "medicationName",
      key: "medicationName",
      render: (name: string | undefined) => name ?? "—",
      ellipsis: true,
    },
    {
      title: t("treatment.dosage"),
      dataIndex: "dosage",
      key: "dosage",
      width: 120,
    },
    {
      title: t("treatment.frequency"),
      dataIndex: "frequency",
      key: "frequency",
      width: 140,
    },
    {
      title: t("treatment.durationDays"),
      dataIndex: "durationDays",
      key: "durationDays",
      width: 90,
      align: "center",
      render: (days: number) => t("treatment.days", { count: days }),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => {
        const cfg = STATUS_CONFIG[status] ?? { color: "default", label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: t("treatment.issuedDate"),
      dataIndex: "issuedAt",
      key: "issuedAt",
      width: 140,
      render: (value: string) =>
        new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value)),
    },
  ];

  const { data: prescriptions, isLoading } = usePatientPrescriptions(patientId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Spin />
      </div>
    );
  }

  const items = prescriptions ?? [];

  if (items.length === 0) {
    return <Empty description={t("treatment.noPrescriptions")} />;
  }

  return (
    <Table<PrescriptionDto>
      columns={COLUMNS}
      dataSource={items}
      rowKey="id"
      pagination={false}
      size="small"
    />
  );
}
