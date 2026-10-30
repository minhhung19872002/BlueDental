import { DatePicker, Input, type FormRule } from "antd";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { LaboLockedField } from "../order-dialogs/LaboLockedField";
import { LaboPictureWell } from "../order-dialogs/LaboPictureWell";
import type { LaboPictures } from "../order-dialogs/useLaboPictures";
import { requiredRule } from "../order-dialogs/useLaboOrderForm";

interface Props {
  /** "lần N" of the Trả hàng this records. */
  returnNo: number;
  pictures: LaboPictures;
  busy: boolean;
}

const DATE_TIME = { showTime: { format: "HH:mm", minuteStep: 5 }, needConfirm: false, format: "DD/MM/YYYY HH:mm" } as const;

/** Hẹn Labo giao lại has to come after the day the work goes back. */
const redeliveryRule: FormRule = ({ getFieldValue }) => ({
  validator: (_, value: Dayjs | undefined) => {
    const returnedAt: Dayjs | undefined = getFieldValue("returnedAt");
    return !value || !returnedAt || value.isAfter(returnedAt)
      ? Promise.resolve()
      : Promise.reject(new Error(t("Labo:Check:RedeliveryAfterReturn")));
  },
});

/**
 * Shown once a tooth is Lỗi: the Ảnh kiểm tra the return needs, and C. Kết
 * luận as owner_ketluan.png draws it — KHÔNG ĐẠT → Trả hàng cho Labo, the
 * Lý do lỗi title over Mô tả gửi Labo, the two dates, Chi phí phát sinh at 0 đ.
 */
export function LaboConclusionBox({ returnNo, pictures, busy }: Props) {
  return (
    <>
      <section className="pd-labo-check-section">
        <header className="pd-labo-check-head">
          <h3>{t("Labo:Check:PicturesTitle")}</h3>
          <span className="pd-labo-check-aside pd-labo-check-aside--required">
            {t("Labo:Check:PicturesHint")}
          </span>
        </header>
        <LaboPictureWell
          tiles={pictures.pictures.map((file, index) => ({
            key: `${index}:${file.name}`,
            url: pictures.previews[index],
            name: file.name,
          }))}
          busy={busy}
          onAdd={pictures.addPictures}
          onRemove={(tile) => pictures.removePicture(Number(tile.key.split(":")[0]))}
        />
      </section>
      <section className="pd-labo-conclusion" aria-label={t("Labo:Check:ConclusionTitle", returnNo)}>
        <header className="pd-labo-check-head">
          <span className="pd-labo-check-badge pd-labo-check-badge--fail">C</span>
          <h3>{t("Labo:Check:ConclusionTitle", returnNo)}</h3>
          <span className="pd-labo-check-aside">{t("Labo:Check:ConclusionHint")}</span>
        </header>
        <p className="pd-labo-conclusion-reason">
          {t("Labo:Check:DefectReason")} <span className="pd-labo-required">*</span>
        </p>
        <FloatingField
          name="description"
          label={t("Labo:Check:Description")}
          required
          rules={requiredRule(t("Labo:Check:DescriptionRequired"))}
        >
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} />
        </FloatingField>
        <div className="pd-labo-check-grid pd-labo-check-grid--three">
          <FloatingField
            name="returnedAt"
            label={t("Labo:Check:ReturnedAt")}
            required
            alwaysFloat
            rules={requiredRule(t("Labo:Check:ReturnedAtRequired"))}
          >
            <DatePicker {...DATE_TIME} className="pd-labo-check-control" />
          </FloatingField>
          <FloatingField
            name="redeliveryDueAt"
            label={t("Labo:Check:RedeliveryDueAt")}
            required
            alwaysFloat
            dependencies={["returnedAt"]}
            rules={[...requiredRule(t("Labo:Check:RedeliveryDueAtRequired")), redeliveryRule]}
          >
            <DatePicker {...DATE_TIME} className="pd-labo-check-control" />
          </FloatingField>
          <LaboLockedField label={t("Labo:Check:ExtraCost")} value={t("Labo:Check:ZeroCost")} required={false} />
        </div>
      </section>
    </>
  );
}
