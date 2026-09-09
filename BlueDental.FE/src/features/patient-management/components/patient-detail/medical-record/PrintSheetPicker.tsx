import { useState } from "react";
import { Button, Checkbox, Popover } from "antd";
import { Printer } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientMedicalRecordDto } from "../../../api/medicalRecordApi";

interface Props {
  sheets: readonly PatientMedicalRecordDto[];
  ordinalOf: (sheet: PatientMedicalRecordDto) => number;
  onPrint: (ids: string[]) => void;
}

/**
 * "In biểu mẫu" while the canvas is showing every sheet.
 *
 * The reference swaps the plain print button for a small panel here — several
 * sheets go to the printer in one run, so it has to ask which. In "Từng phiếu"
 * there is nothing to ask and the button prints what is open.
 */
export function PrintSheetPicker({ sheets, ordinalOf, onPrint }: Props) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const allPicked = sheets.length > 0 && picked.length === sheets.length;
  const somePicked = picked.length > 0 && !allPicked;

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const content = (
    <div className="pd-print-pick">
      <div>
        <p className="pd-print-pick-title">{t("Chọn phiếu in")}</p>
        <p className="pd-print-pick-hint">{t("Chọn các phiếu cần in trong cùng một lần.")}</p>
      </div>

      <label className="pd-print-pick-all">
        <Checkbox
          checked={allPicked}
          indeterminate={somePicked}
          aria-label={t("Chọn tất cả phiếu bệnh án")}
          onChange={(event) => setPicked(event.target.checked ? sheets.map((s) => s.id) : [])}
        />
        {t("Tất cả phiếu")}
      </label>

      <div className="pd-print-pick-list">
        {sheets.map((sheet) => (
          <label key={sheet.id} className="pd-print-pick-row">
            <Checkbox
              checked={picked.includes(sheet.id)}
              aria-label={t("Chọn {0}", sheet.title)}
              onChange={() => toggle(sheet.id)}
            />
            <span>
              <span className="pd-print-pick-name">{sheet.title}</span>
              <span className="pd-print-pick-copy">
                {t("Bản")} {String(ordinalOf(sheet)).padStart(2, "0")}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="pd-print-pick-foot">
        <Button
          type="primary"
          icon={<Printer size={14} />}
          disabled={!picked.length}
          onClick={() => {
            onPrint(picked);
            setOpen(false);
          }}
        >
          {t("In")}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="topRight"
      content={content}
      overlayClassName="pd-print-pick-popover"
    >
      <Button icon={<Printer size={14} />} disabled={!sheets.length}>
        {t("In biểu mẫu")}
      </Button>
    </Popover>
  );
}
