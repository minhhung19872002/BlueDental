import { useEffect, useRef, useState } from "react";
import { Button, Checkbox, DatePicker, Input, Modal, TimePicker } from "antd";
import { CloseOutlined, PictureOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  LABO_TAXONOMY,
  useCreateLaboOrder,
  useLaboMaterialOptions,
  useLaboSupplierOptions,
  useLaboTaxonomyOptions,
  useNextLaboCode,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { useUploadPatientImage } from "../../../api/patientImageApi";

interface Props {
  open: boolean;
  branchId: string;
  patient: { id: string; code: string; name: string };
  plan: TreatmentPlanSlipDto | null;
  /** The công đoạn the order was raised from; the form opens filled from it. */
  stage: TreatmentStageDto | null;
  onClose: () => void;
}

/**
 * One of the reference's chip strips: a scrolling row of choices with a dashed
 * pill in place of an empty list.
 */
function ChipStrip({
  label,
  options,
  value,
  empty,
  dimmed,
  onPick,
}: {
  label: string;
  options: PickerOption[];
  value: string | undefined;
  empty: string;
  dimmed?: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <div className={dimmed ? "pd-labo-strip pd-labo-strip--off" : "pd-labo-strip"}>
      <p>
        {label}
        <span className="floating-field-required">*</span>
      </p>
      {options.length === 0 ? (
        <span className="pd-labo-emptypill">{empty}</span>
      ) : (
        <div className="pd-labo-chips">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={value === option.value ? "active" : undefined}
              onClick={() => onPick(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Đặt mới" — the Labo order the reference raises from a công đoạn's Tạo Labo.
 *
 * Built out of the app's own field components — `SearchSelect` inside a
 * `FloatingLabel` is the same widget the reference uses (a search box over
 * plain rows, with the label riding the border and a red asterisk when the
 * field is required). Measured from the reference on 2026-09-06; see
 * docs/clone/pages/patient-detail.md.
 */
export function LaboOrderDialog({ open, branchId, patient, plan, stage, onClose }: Props) {
  const create = useCreateLaboOrder();
  const uploadImage = useUploadPatientImage();
  const suppliers = useLaboSupplierOptions(branchId, open);
  const services = useLaboTaxonomyOptions(LABO_TAXONOMY.material, branchId, open);
  const bites = useLaboTaxonomyOptions(LABO_TAXONOMY.bite, branchId, open);
  const finishLines = useLaboTaxonomyOptions(LABO_TAXONOMY.finishLine, branchId, open);
  const rhythms = useLaboTaxonomyOptions(LABO_TAXONOMY.rhythm, branchId, open);
  const nextCode = useNextLaboCode(open);

  const fileInput = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [supplierId, setSupplierId] = useState<string>();
  const [serviceGroupId, setServiceGroupId] = useState<string>();
  const [materialId, setMaterialId] = useState<string>();
  const [biteId, setBiteId] = useState<string>();
  const [finishLineId, setFinishLineId] = useState<string>();
  const [rhythmId, setRhythmId] = useState<string>();
  const [shade, setShade] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [sentAt, setSentAt] = useState<Dayjs | null>(null);
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [dueTime, setDueTime] = useState<Dayjs | null>(null);
  const [allTeeth, setAllTeeth] = useState(true);
  /** Chosen but not yet uploaded — the reference shows them as drafts. */
  const [pictures, setPictures] = useState<File[]>([]);

  const materials = useLaboMaterialOptions(branchId, serviceGroupId);

  useEffect(() => {
    if (!open) return;
    // The reference opens with "now" in Ngày gửi / Giờ gửi and everything else blank.
    setSupplierId(undefined);
    setServiceGroupId(undefined);
    setMaterialId(undefined);
    setBiteId(undefined);
    setFinishLineId(undefined);
    setRhythmId(undefined);
    setShade("");
    setQuantity("1");
    setNotes("");
    setSentAt(dayjs());
    setDueDate(null);
    setDueTime(null);
    setAllTeeth(true);
    setPictures([]);
  }, [open, stage?.id]);

  useEffect(() => {
    if (open && nextCode.data) setCode(nextCode.data);
  }, [open, nextCode.data]);

  const teeth = toothLabels(stage?.teeth ?? []);

  const submit = async () => {
    if (!supplierId) {
      toast.error(t("Vui lòng chọn nhà cung cấp"));
      return;
    }
    if (!dueDate) {
      toast.error(t("Vui lòng chọn ngày nhận dự kiến"));
      return;
    }

    const supplierName = suppliers.data?.find((row) => row.value === supplierId)?.label ?? "";

    try {
      await create.mutateAsync({
        patientId: patient.id,
        branchId,
        dentistId: stage?.staffId,
        labProviderName: supplierName,
        orderCode: code.trim() || undefined,
        supplierId,
        materialId,
        biteId,
        finishLineId,
        rhythmId,
        toothNumbers: allTeeth ? teeth.join(", ") || undefined : undefined,
        toothShade: shade.trim() || undefined,
        quantity: Number(quantity) || 1,
        notes: notes.trim() || undefined,
        sentAt: sentAt?.toISOString(),
        // The reference collects the hour separately; the day is what the list
        // sorts and filters on, so the time rides along on the sent stamp only.
        dueDate: dueDate.format("YYYY-MM-DD"),
        estimatedCost: 0,
        treatmentServiceId: stage?.treatmentServiceId,
        treatmentStageId: stage?.id,
      });

      // The pictures belong to the treatment record either way, so they land on
      // the công đoạn the order was raised from.
      if (stage) {
        for (const file of pictures) {
          await uploadImage.mutateAsync({
            patientId: patient.id,
            clinicBranchId: branchId,
            treatmentStageId: stage.id,
            file,
          });
        }
      }

      toast.success(t("Đã tạo phiếu Labo"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      width={880}
      className="pd-labo-dialog"
      title={t("Đặt mới")}
      onCancel={onClose}
      footer={
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={create.isPending || uploadImage.isPending}
          onClick={() => void submit()}
        >
          {t("Lưu")}
        </Button>
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
          setPictures((current) => [...current, ...Array.from(event.target.files ?? [])]);
          // Cleared so choosing the same file twice still fires a change.
          if (fileInput.current) fileInput.current.value = "";
        }}
      />

      <div className="pd-labo-grid">
        <FloatingLabel label={t("Tên khách hàng")} required floated>
          <Input disabled value={`${patient.code} - ${patient.name}`} />
        </FloatingLabel>
        <FloatingLabel label={t("Kế hoạch điều trị")} required floated>
          <Input disabled value={plan ? `${plan.code} - ${plan.dentistName ?? ""}`.trim() : ""} />
        </FloatingLabel>

        <FloatingLabel label={t("Dịch vụ điều trị")} required floated>
          <Input disabled value={stage?.serviceName ?? stage?.name ?? ""} />
        </FloatingLabel>
        <FloatingLabel label={t("Bác sĩ chỉ định")} required floated>
          <Input disabled value={stage?.staffName ?? ""} />
        </FloatingLabel>

        <FloatingLabel label={t("Số phiếu Labo")} required floated>
          <Input value={code} onChange={(event) => setCode(event.target.value)} />
        </FloatingLabel>
        <div className="pd-labo-pair">
          <FloatingLabel label={t("Ngày gửi")} required floated>
            <DatePicker format="DD/MM/YYYY" value={sentAt} onChange={setSentAt} />
          </FloatingLabel>
          <FloatingLabel label={t("Giờ gửi")} required floated>
            <TimePicker format="HH:mm" value={sentAt} onChange={setSentAt} />
          </FloatingLabel>
        </div>

        <FloatingLabel label={t("Nhà cung cấp")} required floated={Boolean(supplierId)}>
          <SearchSelect
            value={supplierId}
            options={suppliers.data ?? []}
            onChange={setSupplierId}
          />
        </FloatingLabel>
        <div className="pd-labo-pair">
          <FloatingLabel label={t("Ngày nhận dự kiến")} required floated={Boolean(dueDate)}>
            <DatePicker format="DD/MM/YYYY" value={dueDate} onChange={setDueDate} />
          </FloatingLabel>
          <FloatingLabel label={t("Giờ nhận")} required floated={Boolean(dueTime)}>
            <TimePicker format="HH:mm" placeholder="HH:mm" value={dueTime} onChange={setDueTime} />
          </FloatingLabel>
        </div>
      </div>

      <ChipStrip
        label={t("Lựa chọn dịch vụ")}
        options={services.data ?? []}
        value={serviceGroupId}
        empty={t("Không có dữ liệu")}
        onPick={(value) => {
          setServiceGroupId(value);
          setMaterialId(undefined);
        }}
      />
      <ChipStrip
        label={t("Vật liệu")}
        options={serviceGroupId ? (materials.data ?? []) : []}
        value={materialId}
        empty={serviceGroupId ? t("Không có dữ liệu") : t("Chọn dịch vụ trước")}
        dimmed={!serviceGroupId}
        onPick={setMaterialId}
      />

      <div className="pd-labo-teeth">
        <p>
          {t("Răng")}:<span className="floating-field-required">*</span>
        </p>
        <Checkbox checked={allTeeth} onChange={(event) => setAllTeeth(event.target.checked)}>
          {t("Chọn tất cả")}
        </Checkbox>
        <div>
          {teeth.length === 0 ? (
            <span className="pd-labo-emptypill">{t("(Trống)")}</span>
          ) : (
            teeth.map((label) => (
              <span key={label} className={allTeeth ? "active" : undefined}>
                {label}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="pd-labo-grid">
        <div className="pd-labo-col">
          <FloatingLabel label={t("Màu răng")} floated={shade.length > 0}>
            <Input value={shade} onChange={(event) => setShade(event.target.value)} />
          </FloatingLabel>
          <FloatingLabel label={t("Số lượng")} required floated>
            <Input
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Khớp cắn")} floated={Boolean(biteId)}>
            <SearchSelect allowClear value={biteId} options={bites.data ?? []} onChange={setBiteId} />
          </FloatingLabel>
        </div>
        <div className="pd-labo-col">
          <FloatingLabel label={t("Đường hoàn tất")} floated={Boolean(finishLineId)}>
            <SearchSelect
              allowClear
              value={finishLineId}
              options={finishLines.data ?? []}
              onChange={setFinishLineId}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Kiểu nhịp")} floated={Boolean(rhythmId)}>
            <SearchSelect
              allowClear
              value={rhythmId}
              options={rhythms.data ?? []}
              onChange={setRhythmId}
            />
          </FloatingLabel>
        </div>
      </div>

      <div className="pd-labo-notes">
        <FloatingLabel label={t("Nội dung")} floated={notes.length > 0}>
          <Input.TextArea
            rows={3}
            value={notes}
            maxLength={1000}
            onChange={(event) => setNotes(event.target.value)}
          />
        </FloatingLabel>
      </div>

      <button type="button" className="pd-labo-drop" onClick={() => fileInput.current?.click()}>
        <PictureOutlined />
        <span>{t("Tải ảnh")}</span>
      </button>

      {pictures.length > 0 && (
        <div className="pd-labo-drafts">
          {pictures.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`}>
              <img src={URL.createObjectURL(file)} alt={file.name} />
              <button
                type="button"
                aria-label={t("Bỏ ảnh {0}", file.name)}
                onClick={() =>
                  setPictures((current) => current.filter((_, at) => at !== index))
                }
              >
                <CloseOutlined />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
