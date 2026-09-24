import { useRef, type ReactNode } from "react";
import { Form, Input } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { ImagePlus } from "lucide-react";
import { FloatingField } from "@/components/FloatingField";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";
import { LaboToothRow } from "./LaboToothRow";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

interface Props {
  form: LaboOrderForm;
  /** What the tooth row shows in place of the chips when there is no tooth. */
  emptyTeeth: ReactNode;
}

/**
 * The lower half every labo order form shares: the tooth row, Màu răng /
 * Số lượng / Khớp cắn / Đường hoàn tất / Kiểu nhịp, Nội dung and Tải ảnh.
 */
export function LaboOrderFields({ form, emptyTeeth }: Props) {
  const { options } = form;
  const fileInput = useRef<HTMLInputElement>(null);
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const quantity = useLaboValue(form.form, "quantity") ?? "";
  // A line that names teeth wants at least one ticked; a line without any,
  // or no line yet, leaves the row alone so an empty Lưu still shows the
  // reference's eight lines. UNKNOWN_REFERENCE_BEHAVIOR for the wording.
  const teethRule = {
    validator: (_: unknown, picked: string[] | undefined) =>
      teeth.length > 0 && !picked?.length
        ? Promise.reject(new Error(t("Patient:DentalChart:RequiredToothDot")))
        : Promise.resolve(),
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          form.addPictures(Array.from(event.target.files ?? []));
          // Cleared so choosing the same file twice still fires a change.
          if (fileInput.current) fileInput.current.value = "";
        }}
      />

      <Form.Item name="picked" rules={[teethRule]}>
        <LaboToothRow form={form} teeth={teeth} empty={emptyTeeth} />
      </Form.Item>

      <div className="pd-labo-grid">
        <div className="pd-labo-col">
          <FloatingField name="shade" label={t("Patient:DentalChart:ToothColor")}>
            <Input />
          </FloatingField>
          <FloatingLabel label={t("Patient:Payment:Quantity")} required floated>
            {/* Counts the ticked teeth; the reference does not let it be typed. */}
            <Input disabled value={quantity} />
          </FloatingLabel>
          <FloatingField name="biteId" label={t("Patient:DentalChart:Occlusion")}>
            <SearchSelect allowClear options={options.bites} />
          </FloatingField>
        </div>
        <div className="pd-labo-col">
          <FloatingField name="finishLineId" label={t("Patient:Viewer:CompletedPath")}>
            <SearchSelect allowClear options={options.finishLines} />
          </FloatingField>
          <FloatingField name="rhythmId" label={t("Patient:DentalChart:RhythmType")}>
            <SearchSelect allowClear options={options.rhythms} />
          </FloatingField>
        </div>
      </div>

      <div className="pd-labo-notes">
        <FloatingField name="notes" label={t("Patient:Library:Content")}>
          <Input.TextArea rows={2} maxLength={1000} />
        </FloatingField>
      </div>

      <button type="button" className="pd-labo-drop" onClick={() => fileInput.current?.click()}>
        <ImagePlus size={22} aria-hidden />
        <span>{t("Patient:Photo:Upload")}</span>
      </button>

      {form.pictures.length > 0 && (
        <div className="pd-labo-drafts">
          {form.pictures.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`}>
              <img src={form.previews[index]} alt={file.name} />
              <button
                type="button"
                aria-label={t("Patient:Photo:RemoveImage", file.name)}
                onClick={() => form.removePicture(index)}
              >
                <CloseOutlined />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
