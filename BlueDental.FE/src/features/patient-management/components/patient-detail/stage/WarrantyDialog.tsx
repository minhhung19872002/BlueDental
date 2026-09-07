import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Select } from "antd";
import { PictureOutlined, SaveOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { FloatingLabel } from "@/components/FloatingLabel";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import { useCreateStage, type TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { useUploadPatientImage } from "../../../api/patientImageApi";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  /** The finished công đoạn the warranty is being raised against. */
  stage: TreatmentStageDto | null;
  onClose: () => void;
}

/**
 * "Tạo bảo hành" — offered on a công đoạn that is finished, when its service
 * carries a warranty period.
 *
 * The reference lays it out exactly like the stage form and writes an ordinary
 * công đoạn with `isGuarantee: true`, which is how its Bảo hành filter finds
 * them again. Measured 2026-09-06; see docs/clone/pages/patient-detail.md.
 */
export function WarrantyDialog({ open, patientId, branchId, plan, stage, onClose }: Props) {
  const staff = useStaffOptions();
  const createStage = useCreateStage();
  const uploadImage = useUploadPatientImage();
  const fileInput = useRef<HTMLInputElement>(null);

  const [staffId, setStaffId] = useState<string>();
  const [subStaffId, setSubStaffId] = useState<string>();
  const [secondStaffId, setSecondStaffId] = useState<string>();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    setStaffId(stage?.staffId);
    setSubStaffId(stage?.subStaffId ?? undefined);
    setSecondStaffId(stage?.secondStaffId ?? undefined);
    setNote("");
    setPending([]);
  }, [open, stage]);

  const line = plan?.services.find((item) => item.id === stage?.treatmentServiceId) ?? null;
  const options = staff.data ?? [];
  const teeth = toothLabels(stage?.teeth ?? []);

  const save = async () => {
    if (!stage || !line || !plan) return;
    if (!staffId) {
      toast.error(t("Vui lòng chọn bác sĩ"));
      return;
    }
    if (!note.trim()) {
      toast.error(t("Vui lòng nhập nội dung điều trị"));
      return;
    }

    try {
      const created = await createStage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentId: plan.id,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        name: line.serviceName ?? line.code,
        note: note.trim(),
        staffId,
        subStaffId,
        secondStaffId,
        teeth: stage.teeth.length > 0 ? stage.teeth : line.teeth,
        isGuarantee: true,
      });

      for (const file of pending) {
        await uploadImage.mutateAsync({
          patientId,
          clinicBranchId: branchId,
          treatmentStageId: created.id,
          file,
        });
      }

      toast.success(t("Đã tạo bảo hành"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      width="calc(100vw - 32px)"
      className="pd-stage-dialog pd-warranty-dialog"
      title={t("Tạo bảo hành")}
      onCancel={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("Đóng")}</Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={createStage.isPending || uploadImage.isPending}
            onClick={() => void save()}
          >
            {t("Lưu bảo hành")}
          </Button>
        </>
      }
      destroyOnHidden
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        hidden
        onChange={(event) => {
          setPending((current) => [...current, ...Array.from(event.target.files ?? [])]);
          if (fileInput.current) fileInput.current.value = "";
        }}
      />

      <div className="pd-stage-form">
        <div>
          <FloatingLabel label={t("Ngày tạo")} floated>
            <Input disabled value={formatDate(new Date().toISOString())} />
          </FloatingLabel>
          <FloatingLabel label={t("Bác sĩ")} floated={Boolean(staffId)}>
            <Select
              showSearch
              optionFilterProp="label"
              value={staffId}
              options={options}
              onChange={setStaffId}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Phụ tá")} floated={Boolean(subStaffId)}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={subStaffId}
              options={options}
              onChange={setSubStaffId}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Bác sĩ hỗ trợ")} floated={Boolean(secondStaffId)}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={secondStaffId}
              options={options}
              onChange={setSecondStaffId}
            />
          </FloatingLabel>
        </div>

        <div>
          <FloatingLabel label={t("Dịch vụ")} floated>
            <Input
              disabled
              value={plan ? `${plan.code} - ${line?.serviceName ?? line?.code ?? ""}` : ""}
            />
          </FloatingLabel>
          <div className="pd-stage-teeth">
            <p>{t("Răng")}:</p>
            <div>
              {teeth.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
          <div className="pd-stage-images">
            <p>{t("Hình ảnh")}:</p>
            <p>{pending.length === 0 ? t("(Trống)") : t("{0} ảnh đã chọn", pending.length)}</p>
          </div>
          <Button block icon={<PictureOutlined />} onClick={() => fileInput.current?.click()}>
            {t("Tải Ảnh")}
          </Button>
        </div>

        <div>
          <FloatingLabel label={t("Nội dung điều trị")} floated={note.length > 0}>
            <Input.TextArea
              rows={5}
              value={note}
              maxLength={1000}
              onChange={(event) => setNote(event.target.value)}
            />
          </FloatingLabel>
          <p className="pd-stage-list">{t("Danh sách công đoạn")}</p>
          <p className="pd-stage-listempty">{t("(Trống)")}</p>
        </div>
      </div>
    </Modal>
  );
}
