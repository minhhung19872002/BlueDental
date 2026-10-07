import { useState } from "react";
import { Button } from "antd";
import { DownOutlined, FolderOpenOutlined, UpOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RxDiagnosisRow } from "../../types/prescription";
import { RxDiagnosisTable } from "./RxDiagnosisTable";
import { RxIcdSearch } from "./RxIcdSearch";
import { RxTreatmentSlipPicker } from "./RxTreatmentSlipPicker";

interface Props {
  rows: RxDiagnosisRow[];
  printedText: string | null;
  sources: RxDiagnosisRow[];
  sourcesLoading: boolean;
  pickedKeys: ReadonlySet<string>;
  onToggle: (row: RxDiagnosisRow) => void;
  onRemove: (key: string) => void;
}

/**
 * "Chẩn đoán" — a card that folds (open by default): the ICD-10 search and the
 * "Danh mục ICD-10" button, the picker panel under them when open, then the
 * picked diagnoses (F-58).
 */
export function RxDiagnosisSection({
  rows,
  printedText,
  sources,
  sourcesLoading,
  pickedKeys,
  onToggle,
  onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const handleBrowse = () => {
    setExpanded(true);
    setCatalogOpen(true);
  };

  return (
    <section className="rx-section rx-dx" aria-label={t("Treatment:Rx:Diagnosis")}>
      <header className="rx-section-head">
        <h3 className="rx-section-title">{t("Treatment:Rx:Diagnosis")}</h3>
        {rows.length > 0 && (
          <span className="rx-chip">{t("Treatment:Rx:DiagnosisPicked", rows.length)}</span>
        )}
        <Button
          type="text"
          size="small"
          className="rx-section-toggle"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          aria-expanded={expanded}
          aria-label={expanded ? t("Treatment:Rx:Collapse") : t("Treatment:Rx:Expand")}
          onClick={() => setExpanded((value) => !value)}
        />
      </header>

      {expanded && (
        <div className="rx-section-body">
          <div className="rx-dx-toolbar">
            <RxIcdSearch onBrowse={handleBrowse} />
            <Button
              icon={catalogOpen ? <UpOutlined /> : <FolderOpenOutlined />}
              className="rx-soft-btn"
              aria-expanded={catalogOpen}
              onClick={() => setCatalogOpen((value) => !value)}
            >
              {catalogOpen ? t("Treatment:Rx:IcdCatalogClose") : t("Treatment:Rx:IcdCatalog")}
            </Button>
          </div>
          {catalogOpen && (
            <RxTreatmentSlipPicker
              sources={sources}
              loading={sourcesLoading}
              pickedKeys={pickedKeys}
              onToggle={onToggle}
              onClose={() => setCatalogOpen(false)}
            />
          )}
          <RxDiagnosisTable rows={rows} printedText={printedText} onRemove={onRemove} />
        </div>
      )}
    </section>
  );
}
