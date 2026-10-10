import { Fragment } from "react";
import { Alert } from "antd";
import { t } from "@/lib/i18n";
import type { OrgUnitFormValues } from "./orgUnitForm";

export type OrgFormField = keyof OrgUnitFormValues;

/** Form order, with the label each field shows. */
const FIELD_LABELS: readonly { field: OrgFormField; labelKey: string }[] = [
  { field: "kind", labelKey: "OrgChart:Field:kind" },
  { field: "name", labelKey: "OrgChart:Field:name" },
  { field: "parentId", labelKey: "OrgChart:Field:parent" },
  { field: "code", labelKey: "OrgChart:Field:code" },
  { field: "headStaffId", labelKey: "OrgChart:Field:head" },
  { field: "memberIds", labelKey: "OrgChart:Field:members" },
];

/** The form fields that currently show an error, in form order. */
export function erroredFields(fields: { name: unknown; errors?: string[] }[]): OrgFormField[] {
  const errored = new Set(
    fields.filter((f) => f.errors && f.errors.length > 0).map((f) => (Array.isArray(f.name) ? f.name[0] : f.name)),
  );
  return FIELD_LABELS.filter(({ field }) => errored.has(field)).map(({ field }) => field);
}

interface Props {
  fields: OrgFormField[];
  onJump: (field: OrgFormField) => void;
}

/** "Còn n lỗi cần sửa trước khi lưu: Tên đơn vị, Trưởng đơn vị." — each label jumps to its field (BA mock). */
export function OrgFormErrorSummary({ fields, onJump }: Props) {
  if (fields.length === 0) return null;
  const shown = FIELD_LABELS.filter(({ field }) => fields.includes(field));

  return (
    <Alert
      type="error"
      showIcon
      className="org-form__error"
      message={
        <span>
          {t("OrgChart:Dialog:ErrorSummary", fields.length)}{" "}
          {shown.map(({ field, labelKey }, i) => (
            <Fragment key={field}>
              {i > 0 && ", "}
              <button type="button" className="org-form__error-link" onClick={() => onJump(field)}>
                {t(labelKey)}
              </button>
            </Fragment>
          ))}
          .
        </span>
      }
    />
  );
}
