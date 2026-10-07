import { useState } from "react";
import { Button, Checkbox, Input, Spin } from "antd";
import { FileTextOutlined, SearchOutlined, UpOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RxDiagnosisRow } from "../../types/prescription";
import {
  groupBySession,
  matchesSlipFilter,
  teethLabel,
  type RxSessionGroup,
} from "../../utils/rxDiagnosis";

interface Props {
  sources: RxDiagnosisRow[];
  loading: boolean;
  pickedKeys: ReadonlySet<string>;
  onToggle: (row: RxDiagnosisRow) => void;
  onClose: () => void;
}

/** "Buổi điều trị hôm nay · 3 chẩn đoán" — the heading of one day of the picker. */
function sessionHeading({ day, isToday, rows }: RxSessionGroup): string {
  if (isToday) return t("Treatment:Rx:SessionToday", rows.length);
  if (!day) return t("Treatment:Rx:SessionUndated", rows.length);
  return t("Treatment:Rx:SessionOn", day, rows.length);
}

/**
 * The "Danh mục ICD-10" panel under the toolbar. Until an ICD-10 catalog
 * exists it holds a single group, "Phiếu điều trị": every diagnosis of the
 * patient's treatment slips, one tick per diagnosis of a slip, the slip number
 * where the mock shows the ICD code. Rows are grouped by "Buổi điều trị", the
 * day the slip was opened, newest first, as in the mock (F-58).
 */
export function RxTreatmentSlipPicker({ sources, loading, pickedKeys, onToggle, onClose }: Props) {
  const [filter, setFilter] = useState("");
  const groups = groupBySession(sources.filter((row) => matchesSlipFilter(row, filter)));

  const renderList = () => {
    if (loading) return <Spin className="rx-slip-spin" />;
    if (sources.length === 0)
      return <p className="rx-slip-empty">{t("Treatment:Rx:NoTreatmentSlip")}</p>;
    if (groups.length === 0)
      return <p className="rx-slip-empty">{t("Treatment:Rx:NoSlipMatch")}</p>;
    return groups.map((group) => (
      <section key={group.day} className="rx-slip-group">
        <h4 className="rx-slip-heading">{sessionHeading(group)}</h4>
        {group.rows.map((row) => (
          <Checkbox
            key={row.key}
            className="rx-slip-row"
            checked={pickedKeys.has(row.key)}
            onChange={() => onToggle(row)}
          >
            <span className="rx-code-tag">{row.planCode}</span>
            <span className="rx-slip-text">
              <strong className="rx-slip-name">{row.diagnosisName}</strong>
              {row.toothCodes.length > 0 && (
                <span className="rx-slip-teeth">{teethLabel(row.toothCodes)}</span>
              )}
            </span>
          </Checkbox>
        ))}
      </section>
    ));
  };

  return (
    <div className="rx-slip-panel" role="region" aria-label={t("Treatment:Rx:IcdCatalogTitle")}>
      <div className="rx-slip-panel-head">
        <span className="rx-slip-panel-title">{t("Treatment:Rx:IcdCatalogTitle")}</span>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          className="rx-slip-filter"
          placeholder={t("Treatment:Rx:SlipFilter")}
          aria-label={t("Treatment:Rx:SlipFilter")}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <Button type="text" icon={<UpOutlined />} iconPlacement="end" onClick={onClose}>
          {t("Treatment:Rx:Collapse")}
        </Button>
      </div>
      <div className="rx-slip-panel-body">
        <nav className="rx-slip-nav">
          <span className="rx-slip-nav-item rx-slip-nav-item--active">
            <FileTextOutlined />
            {t("Treatment:Rx:TreatmentSlips")}
            <span className="rx-slip-nav-count">{sources.length}</span>
          </span>
        </nav>
        <div className="rx-slip-list">{renderList()}</div>
      </div>
      <div className="rx-slip-panel-foot">
        <span>{t("Treatment:Rx:PickerHint", pickedKeys.size)}</span>
        <Button type="primary" onClick={onClose}>
          {t("Treatment:Rx:PickerDone")}
        </Button>
      </div>
    </div>
  );
}
