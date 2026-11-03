import { Form, Input } from "antd";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { LaboSpecGap, LaboSpecRow } from "./laboToothSpecs";
import { LaboPictureWell, type LaboPictureTile } from "./LaboPictureWell";

/** The lists of the row's selects. */
export interface LaboSpecOptions {
  finishLines: PickerOption[];
  rhythms: PickerOption[];
  bites: PickerOption[];
}

/** The row's own pictures — the Ảnh cell. */
export interface LaboSpecPictures {
  tiles: LaboPictureTile[];
  onAdd: (files: File[]) => void;
  onRemove: (tile: LaboPictureTile) => void;
}

interface Props {
  row: LaboSpecRow;
  /** What the row still lacks; it reads pink with the missing cells red. */
  gap: LaboSpecGap | undefined;
  options: LaboSpecOptions;
  pictures: LaboSpecPictures;
  readOnly: boolean;
  busy: boolean;
}

/**
 * One row of Thông số từng răng (P3110 m139, REQ-C7): Màu răng (free text,
 * several shades split by "/"), Đường hoàn tất, Kiểu nhịp, Khớp cắn (D3),
 * the tooth's pictures and Ghi chú cho Labo.
 */
export function LaboToothSpecRow({ row, gap, options, pictures, readOnly, busy }: Props) {
  const field = (name: string) => ["specs", row.key, name];
  const select = (name: string, list: PickerOption[], missing = false) => (
    <Form.Item name={field(name)} noStyle>
      <SearchSelect
        allowClear
        options={list}
        placeholder={t("Labo:Spec:Choose")}
        status={missing ? "error" : ""}
        disabled={readOnly}
      />
    </Form.Item>
  );

  return (
    <tr className={gap ? "pd-labo-spec-row pd-labo-spec-row--gap" : "pd-labo-spec-row"} data-tooth={row.key}>
      <th scope="row">{row.label}</th>
      <td>
        <Form.Item name={field("shade")} noStyle>
          <Input
            maxLength={100}
            status={gap?.shade ? "error" : ""}
            aria-label={`${t("Patient:DentalChart:ToothColor")} ${row.label}`}
          />
        </Form.Item>
      </td>
      <td>{select("finishLineId", options.finishLines, gap?.finishLine)}</td>
      <td>{select("rhythmId", options.rhythms)}</td>
      <td>{select("biteId", options.bites)}</td>
      <td>
        <LaboPictureWell
          variant="cell"
          tiles={pictures.tiles}
          busy={busy}
          readOnly={readOnly}
          onAdd={pictures.onAdd}
          onRemove={pictures.onRemove}
        />
      </td>
      <td>
        <Form.Item name={field("labNote")} noStyle>
          <Input
            maxLength={1000}
            placeholder={t("Labo:Spec:NotePlaceholder")}
            aria-label={`${t("Labo:Spec:Note")} ${row.label}`}
          />
        </Form.Item>
      </td>
    </tr>
  );
}
