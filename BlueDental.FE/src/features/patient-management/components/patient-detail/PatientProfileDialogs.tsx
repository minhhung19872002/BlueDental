import { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Popover, Select, type TableColumnsType } from "antd";
import { SearchOutlined, TagsOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { DataTable } from "@/components/DataTable";
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";
import {
  paymentKindConfig,
  paymentMethodLabels,
  type PatientPaymentDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { useUpdatePatient } from "../../api/patientMutations";
import { GENDER_BY_CODE } from "../../api/patientAdapters";
import type { PatientDto, UpdatePatientRequest } from "../../types/patient";

function patientPayload(patient: PatientDto): UpdatePatientRequest {
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: GENDER_BY_CODE[patient.gender] ?? "other",
    phoneNumber: patient.phoneNumber ?? undefined,
    email: patient.email ?? undefined,
    nationalId: patient.nationalId ?? undefined,
    patientCode: patient.patientCode,
    sourceTaxonomyId: patient.sourceTaxonomyId,
    sourceEntryId: patient.sourceEntryId,
    occupationEntryId: patient.occupationEntryId,
    occupationOther: patient.occupationOther,
    insuranceNumber: patient.insuranceNumber,
    address: patient.address,
    provinceCode: patient.provinceCode,
    wardCode: patient.wardCode,
    examinationReason: patient.examinationReason,
    note: patient.note,
    tagIds: patient.tagIds,
    diseaseHistoryEntryIds: patient.diseaseHistoryEntryIds,
  };
}

export function PatientTagPicker({ patient }: { patient: PatientDto }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const tags = usePatientTagOptions();
  const update = useUpdatePatient(patient.id);
  const visible = useMemo(
    () =>
      (tags.data ?? []).filter((tag) =>
        tag.label.toLocaleLowerCase("vi").includes(filter.trim().toLocaleLowerCase("vi")),
      ),
    [filter, tags.data],
  );

  const toggle = async (tagId: string) => {
    const selected = patient.tagIds.includes(tagId);
    const tagIds = selected
      ? patient.tagIds.filter((id) => id !== tagId)
      : [...patient.tagIds, tagId];
    try {
      await update.mutateAsync({ ...patientPayload(patient), tagIds });
      toast.success(selected ? t("Đã bỏ tag") : t("Đã thêm tag"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      classNames={{ root: "pd-tag-popover" }}
      content={
        <div className="pd-tag-picker">
          <Input
            allowClear
            value={filter}
            prefix={<SearchOutlined />}
            placeholder={t("Tìm tag")}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="pd-tag-options">
            {visible.map((tag) => {
              const selected = patient.tagIds.includes(tag.value);
              return (
                <button
                  type="button"
                  key={tag.value}
                  className={selected ? "selected" : ""}
                  onClick={() => void toggle(tag.value)}
                  disabled={update.isPending}
                >
                  <span style={{ backgroundColor: tag.color }}>
                    <TagsOutlined /> {tag.label}
                  </span>
                  <em>{tag.label}</em>
                </button>
              );
            })}
            {!tags.isLoading && visible.length === 0 ? (
              <div className="pd-tag-empty">{t("Không tìm thấy tag")}</div>
            ) : null}
          </div>
        </div>
      }
    >
      <Button className="pd-tag-button" icon={<TagsOutlined />} aria-label={t("Nhãn bệnh nhân")} />
    </Popover>
  );
}

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
  const update = useUpdatePatient(patient.id);
  useEffect(() => {
    if (open) setReason(patient.examinationReason ?? "");
  }, [open, patient.examinationReason]);

  const save = async () => {
    try {
      await update.mutateAsync({ ...patientPayload(patient), examinationReason: reason.trim() });
      toast.success(t("Đã cập nhật lý do đến khám"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("Lý do đến khám")}
      width={520}
      okText={t("Lưu")}
      cancelText={t("Hủy")}
      confirmLoading={update.isPending}
      onOk={() => void save()}
      onCancel={onClose}
      destroyOnHidden
    >
      <Input.TextArea
        value={reason}
        rows={4}
        maxLength={1000}
        showCount
        placeholder={t("Nhập lý do đến khám")}
        onChange={(event) => setReason(event.target.value)}
      />
    </Modal>
  );
}

export function RecallDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      title={t("Tạo tái khám")}
      width="calc(100vw - 32px)"
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      className="pd-recall-dialog"
    >
      <div className="pd-recall-head">
        <strong>{t("Ngày - Nhân sự")}</strong>
        <strong>{t("Dịch vụ đã hoàn tất")}</strong>
        <strong>{t("Nội dung điều trị")}</strong>
      </div>
      <div className="pd-recall-empty">{t("Chưa có dịch vụ hoàn tất")}</div>
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
    { title: t("Mã thanh toán"), dataIndex: "code", width: 130 },
    { title: t("Ngày tạo"), dataIndex: "paidAt", width: 145, render: formatDateTime },
    {
      title: t("Dịch vụ điều trị"),
      dataIndex: "treatmentPlanCode",
      width: 200,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Tổng tiền phiếu"),
      dataIndex: "amount",
      width: 150,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: t("Thanh toán"),
      dataIndex: "kind",
      width: 130,
      render: (value: PatientPaymentDto["kind"]) => paymentKindConfig()[value].label,
    },
    {
      title: t("Phương thức thanh toán"),
      dataIndex: "method",
      width: 180,
      render: (value: PatientPaymentDto["method"]) => paymentMethodLabels()[value],
    },
    { title: t("Ghi chú"), dataIndex: "note", width: 180, render: (v: string | null) => v ?? "—" },
    { title: t("Thao tác"), width: 90, fixed: "right", render: () => "—" },
  ];
  return (
    <Modal
      open={open}
      title={t("Thanh toán")}
      width={1024}
      onCancel={onClose}
      destroyOnHidden
      className="pd-payment-dialog"
      footer={
        <Button type="primary" onClick={onClose}>
          {t("Đóng")}
        </Button>
      }
    >
      <DataTable<PatientPaymentDto>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={payments}
        pagination={false}
        locale={{ emptyText: t("Chưa có phiếu thanh toán") }}
      />
      <div className="pd-payment-pager">
        <div>
          <Select value={20} options={[{ value: 20, label: t("20 / trang") }]} />
          <span>
            {t(
              "Hiển thị {0} trên {1} phiếu thanh toán",
              Math.min(20, payments.length),
              payments.length,
            )}
          </span>
        </div>
        <div>
          <Button disabled>‹ {t("Trước")}</Button>
          <Button disabled>{t("Sau")} ›</Button>
        </div>
      </div>
      <div className="pd-payment-total">
        <strong>{t("Tổng tiền:")}</strong> <b>{formatVND(total)} đ</b>
      </div>
    </Modal>
  );
}
