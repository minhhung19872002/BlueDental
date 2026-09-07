import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button, Input, Modal, Popover, Select, type TableColumnsType } from "antd";
import { CheckOutlined, SearchOutlined, TagsOutlined } from "@ant-design/icons";
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
import { useAddExaminationReason, useUpdatePatient } from "../../api/patientMutations";
import { GENDER_BY_CODE } from "../../api/patientAdapters";
import type { PatientDto, UpdatePatientRequest } from "../../types/patient";
// These dialogs carry their own styling, so they look right wherever opened.
import "./patient-detail.css";

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

/**
 * A Thẻ hồ sơ as the reference draws it: the tag's own colour, white bold text
 * and a tag glyph. The same chip appears in the picker and beside the name, so
 * it carries a class of its own — as a bare `<span>` it also matched the
 * picker row's chip rule, which painted the ✓ beside it white on white.
 */
export function PatientTagChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="pd-tag-chip" style={{ "--pd-tag-color": color } as CSSProperties}>
      <TagsOutlined /> {label}
    </span>
  );
}

export function PatientTagPicker({ patient }: { patient: PatientDto }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const tags = usePatientTagOptions(patient.branchId);
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
      placement="bottomLeft"
      // No arrow on the reference, and AntD reserves room for one — which was
      // the whole difference between its 9px gap and ours.
      arrow={false}
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
                  <PatientTagChip color={tag.color} label={tag.label} />
                  <em>{tag.label}</em>
                  {selected ? <CheckOutlined className="pd-tag-tick" /> : null}
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
      toast.error(t("Vui lòng nhập lý do đến khám"));
      return;
    }
    try {
      await add.mutateAsync(content);
      toast.success(t("Đã thêm lý do đến khám"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={t("Thêm lý do đến khám")}
      // 500px, measured off the reference's own dialog.
      width={500}
      className="pd-reason-dialog"
      okText={t("Lưu")}
      cancelText={t("Hủy")}
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
        placeholder={t("Nhập lý do đến khám")}
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
    { title: t("Mã thanh toán"), dataIndex: "code", width: 150 },
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
      width: 215,
      render: (value: PatientPaymentDto["method"]) => paymentMethodLabels()[value],
    },
    { title: t("Ghi chú"), dataIndex: "note", width: 180, render: (v: string | null) => v ?? "—" },
    { title: t("Thao tác"), width: 90, fixed: "right", render: () => "—" },
  ];
  return (
    <Modal
      open={open}
      title={t("Thanh toán")}
      // The eight columns need 1260px between them. At 1024 the pinned Thao tác
      // column sat on top of "Phương thức thanh toán" and clipped its title.
      width="min(1320px, calc(100vw - 48px))"
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
