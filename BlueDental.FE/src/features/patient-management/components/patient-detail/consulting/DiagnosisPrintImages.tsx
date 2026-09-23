import { useState } from "react";
import { Button, Checkbox, Modal, Tooltip } from "antd";
import { Images } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";

interface Props {
  /** Every photograph on the patient's record. */
  images: PatientImageViewModel[];
  /** Which of the shown ones go onto the sheet. */
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
}

/**
 * "Ảnh chẩn đoán" — the left card of the "In chẩn đoán" dialog.
 *
 * Two levels of choosing, the reference's own: the "Danh sách ảnh" dialog says
 * which photographs the card offers at all, and ticking one on the card puts it
 * on the printed sheet.
 */
export function DiagnosisPrintImages({ images, selected, onSelectedChange }: Props) {
  const [listOpen, setListOpen] = useState(false);
  // Offered unless taken out of the list, so the card is useful the moment it
  // opens rather than empty until something is picked.
  const [dropped, setDropped] = useState<string[]>([]);
  const offered = images.filter((image) => !dropped.includes(image.id));

  const toggleSelected = (id: string) => {
    onSelectedChange(
      selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id],
    );
  };

  const toggleOffered = (id: string) => {
    if (!dropped.includes(id)) {
      setDropped((current) => [...current, id]);
      onSelectedChange(selected.filter((other) => other !== id));
      return;
    }
    setDropped((current) => current.filter((other) => other !== id));
  };

  return (
    <>
      <div className="dp-images">
        <div className="dp-images-head">
          <div>
            <p className="dp-images-title">{t("Patient:Diagnosis:Images")}</p>
            <p className="dp-images-hint">{t("Patient:Diagnosis:ImageHint")}</p>
          </div>
          <Tooltip title={t("Patient:Diagnosis:ImageList")}>
            <button
              type="button"
              className="dp-images-open"
              aria-label={t("Patient:Diagnosis:ImageList")}
              onClick={() => setListOpen(true)}
            >
              <Images size={20} />
            </button>
          </Tooltip>
        </div>

        {offered.length > 0 ? (
          <div className="dp-images-list">
            {offered.map((image) => (
              <div key={image.id} className="dp-images-item">
                <Checkbox
                  className="dp-images-tick"
                  checked={selected.includes(image.id)}
                  aria-label={t("Patient:Diagnosis:SelectImageLabel", image.fileName)}
                  onChange={() => toggleSelected(image.id)}
                />
                <button
                  type="button"
                  aria-label={t("Patient:Diagnosis:SelectImageLabel", image.fileName)}
                  onClick={() => toggleSelected(image.id)}
                >
                  <img src={image.url} alt={image.fileName} loading="lazy" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button type="button" className="dp-images-empty" onClick={() => setListOpen(true)}>
            <Images size={32} />
            {t("Patient:Diagnosis:NoImagesHint")}
          </button>
        )}
      </div>

      <Modal
        open={listOpen}
        title={t("Patient:Diagnosis:ImageList")}
        width={1024}
        zIndex={1300}
        destroyOnHidden
        onCancel={() => setListOpen(false)}
        footer={
          <div className="dp-list-foot">
            <Button onClick={() => setDropped([])}>{t("Common:SelectAll")}</Button>
            <Button type="primary" onClick={() => setListOpen(false)}>
              {t("Common:Close")}
            </Button>
          </div>
        }
      >
        {images.length === 0 ? (
          <div className="dp-list-empty">{t("Patient:Diagnosis:NoImages")}</div>
        ) : (
          <div className="dp-list-grid">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                className={["dp-list-card", !dropped.includes(image.id) && "dp-list-card--on"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => toggleOffered(image.id)}
              >
                <Checkbox
                  className="dp-list-tick"
                  checked={!dropped.includes(image.id)}
                  aria-label={t("Patient:Diagnosis:ShowImageLabel", image.fileName)}
                />
                <img src={image.url} alt={image.fileName} loading="lazy" />
                <span>{image.fileName}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
