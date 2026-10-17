import { useState } from "react";
import { Popover, Tooltip } from "antd";
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RecordSetDto } from "../../../api/medicalRecordSetApi";
import { MEDICAL_RECORD_FORMS } from "../medicalRecordForms";
import { isCancelledSet, setCodesLine, setDiagnosisLine } from "./recordSetView";

/**
 * The head of "Mục lục bệnh án": the bộ hồ sơ being shown — "MỤC LỤC BỆNH
 * ÁN · N BỘ" over its code, over "{Mã phiếu chẩn đoán} - {Mã phiếu điều trị} ·
 * n/9 mục hiển thị" — and, dropped down, every set
 * of the patient: newest first, each by the diagnosis of its newest slip, the
 * cancelled ones last. The clinic's design, save/P1710.drawio.
 */

interface Props {
  sets: RecordSetDto[];
  active: RecordSetDto;
  /** Slips not in any live set — the count under "Tạo bộ hồ sơ mới". */
  freeSlipCount: number;
  onSelect: (set: RecordSetDto) => void;
  onCreate?: () => void;
  onEdit?: (set: RecordSetDto) => void;
  onCancel?: (set: RecordSetDto) => void;
}

export function RecordSetPicker({
  sets,
  active,
  freeSlipCount,
  onSelect,
  onCreate,
  onEdit,
  onCancel,
}: Props) {
  const [open, setOpen] = useState(false);

  /** Every action in the list closes it first, so a dialog never opens under it. */
  const closeThen = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const panel = (
    <div className="rs-picker-panel">
      <p className="rs-picker-title">{t("Patient:RecordSet:ListTitle")}</p>
      <ul className="rs-picker-list">
        {sets.map((set) => {
          const cancelled = isCancelledSet(set);
          return (
            <li
              key={set.id}
              className={[
                "rs-picker-item",
                set.id === active.id && "rs-picker-item--active",
                cancelled && "rs-picker-item--cancelled",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="rs-picker-open"
                onClick={closeThen(() => onSelect(set))}
              >
                <strong>{set.code}</strong>
                <span>{setDiagnosisLine(set)}</span>
              </button>
              {cancelled ? (
                <span className="rs-pill rs-pill--cancelled">
                  {t("Patient:RecordSet:Cancelled")}
                </span>
              ) : (
                <span className="rs-picker-actions">
                  {onEdit && (
                    <Tooltip title={t("Patient:RecordSet:Edit")}>
                      <button
                        type="button"
                        aria-label={t("Patient:RecordSet:EditLabel", set.code)}
                        onClick={closeThen(() => onEdit(set))}
                      >
                        <EditOutlined />
                      </button>
                    </Tooltip>
                  )}
                  {onCancel && (
                    <Tooltip title={t("Patient:RecordSet:CancelTitle")}>
                      <button
                        type="button"
                        className="rs-picker-cancel"
                        aria-label={t("Patient:RecordSet:CancelLabel", set.code)}
                        onClick={closeThen(() => onCancel(set))}
                      >
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {onCreate && (
        <button type="button" className="rs-picker-new" onClick={closeThen(onCreate)}>
          <PlusOutlined /> {t("Patient:RecordSet:New")}
        </button>
      )}
      <p className="rs-picker-free">{t("Patient:RecordSet:FreeSlips", freeSlipCount)}</p>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      content={panel}
      classNames={{ root: "rs-picker-popover" }}
    >
      <button
        type="button"
        className="rs-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("Patient:RecordSet:Choose")}
      >
        <span className="rs-picker-icon" aria-hidden="true">
          <FileTextOutlined />
        </span>
        <span className="rs-picker-text">
          <small className="rs-picker-overline">
            {t("Patient:RecordSet:IndexCount", sets.length)}
          </small>
          <strong>
            {active.code}
            {isCancelledSet(active) && (
              <span className="rs-pill rs-pill--cancelled">{t("Patient:RecordSet:Cancelled")}</span>
            )}
          </strong>
          <small>
            {setCodesLine(active)} ·{" "}
            {t(
              "Patient:RecordSet:ShownForms",
              active.visibleForms.length,
              MEDICAL_RECORD_FORMS.length,
            )}
          </small>
        </span>
        <DownOutlined className="rs-picker-caret" aria-hidden="true" />
      </button>
    </Popover>
  );
}
