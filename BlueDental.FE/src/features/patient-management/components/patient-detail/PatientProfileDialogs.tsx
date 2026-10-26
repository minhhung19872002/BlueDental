import { useEffect, useState } from "react";
import { Button, Input, Modal, Select, type TableColumnsType } from "antd";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit } from "@/utils/format";
import {
  paymentKindConfig,
  paymentMethodLabels,
  type PatientPaymentDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { useAddExaminationReason } from "../../api/patientMutations";
import type { PatientDto } from "../../types/patient";
// These dialogs carry their own styling, so they look right wherever opened.
import "./patient-detail.css";

/**
 * "Thêm lý do đến khám".
 *
 * The reference opens this box empty even on a record that already has
 * reasons — Lưu adds a dated line rather than rewriting the last one. The hồ sơ
 * dialog is where an existing reason gets corrected.
 */
export function ExaminationReasonDialog({
  open,
  patient,
  onClose,
}: {
  open: boolean;
  patient: PatientDto;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const add = useAddExaminationReason(patient.id);
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const save = async () => {
    const content = reason.trim();
    if (!content) {
      toast.error(t("Patient:Misc:RequiredVisitReason"));
      return;
    }
    try {
      await add.mutateAsync(content);
      toast.success(t("Patient:Source:ReasonAdded"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("Patient:Source:AddReason")}
      // 500px, measured off the reference's own dialog.
      width={500}
      className="pd-reason-dialog"
      okText={t("Patient:Misc:Save")}
      cancelText={t("Patient:Misc:Cancel")}
      confirmLoading={add.isPending}
      onOk={() => void save()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Input.TextArea
        value={reason}
        rows={6}
        className="pd-reason-input"
        maxLength={1000}
        showCount
        placeholder={t("Patient:Source:EnterReason")}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}

export function PatientPaymentDialog({
  open,
  payments,
  total,
  onClose,
}: {
  open: boolean;
  payments: PatientPaymentDto[];
  total: number;
  onClose: () => void;
}) {
  const columns: TableColumnsType<PatientPaymentDto> = [
    { title: t("Patient:Payment:Code"), dataIndex: "code", width: 192 },
    { title: t("Patient:Col:CreatedAt"), dataIndex: "paidAt", width: 128, render: formatDateTime },
    {
      title: t("Patient:Plan:Service"),
      dataIndex: "treatmentPlanCode",
      width: 140,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Patient:Payment:SlipTotal"),
      dataIndex: "amount",
      width: 132,
      align: "right",
      render: (value: number) => formatMoneyUnit(value),
    },
    {
      title: t("Patient:Payment:PaymentLabel"),
      dataIndex: "kind",
      width: 96,
      render: (value: PatientPaymentDto["kind"]) => paymentKindConfig()[value].label,
    },
    {
      title: t("Patient:Payment:Method"),
      dataIndex: "method",
      width: 188,
      render: (value: PatientPaymentDto["method"]) => paymentMethodLabels()[value],
    },
    { title: t("Patient:Debt:Note"), dataIndex: "note", width: 200, render: (v: string | null) => v ?? "—" },
    { title: t("Common:Actions"), width: 88, fixed: "right", render: () => "—" },
  ];
  return (
    <Modal
      open={open}
      title={t("Patient:Payment:PaymentLabel")}
      // The eight columns need about 1170px between them. At 1024 the pinned Thao tác
      // column sat on top of "Phương thức thanh toán" and clipped its title.
      width="min(1320px, calc(100vw - 48px))"
      onCancel={onClose}
      destroyOnHidden
      className="pd-payment-dialog"
      footer={
        <Button type="primary" onClick={onClose}>
          {t("Common:Close")}
        </Button>
      }
    >
      <DataTable<PatientPaymentDto>
        rowKey="id"
        columns={columns}
        dataSource={payments}
        pagination={false}
        locale={{ emptyText: t("Patient:Payment:Empty") }}
      />
      <div className="pd-payment-pager">
        <div>
          <Select value={20} options={[{ value: 20, label: t("20 / trang") }]} />
          <span>
            {t(
              "Patient:Payment:ShowingCount",
              Math.min(20, payments.length),
              payments.length,
            )}
          </span>
        </div>
        <div>
          <Button disabled>‹ {t("Patient:Stage:Before")}</Button>
          <Button disabled>{t("Common:Next")} ›</Button>
        </div>
      </div>
      <div className="pd-payment-total">
        <strong>{t("Patient:Payment:TotalLabel")}</strong> <b>{formatMoneyUnit(total)}</b>
      </div>
    </Modal>
  );
}
