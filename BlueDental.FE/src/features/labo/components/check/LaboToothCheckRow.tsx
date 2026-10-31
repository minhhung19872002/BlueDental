import { Form } from "antd";
import { CaretDownOutlined, CaretUpOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LABO_TOOTH_RESULT, type LaboOrderDto, type LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { LaboToothDefectGroup } from "./LaboToothDefectGroup";
import { LaboToothResultToggle } from "./LaboToothResultToggle";
import { LaboReturnCount, LaboToothShade, LaboToothWarranty } from "./LaboToothCells";
import { pickOf, returnNotes, shownReturnCount, toothKey } from "./laboCheckRules";
import type { LaboCheckForm } from "./useLaboCheckForm";

interface Props {
  tooth: LaboOrderToothDto;
  order: LaboOrderDto;
  check: LaboCheckForm;
}

/**
 * One tooth to check (P3110 m238, m278, m342): Đạt keeps the row short, Lỗi
 * opens its Kết luận to fill in; «Thu gọn» folds an open one.
 */
export function LaboToothCheckRow({ tooth, order, check }: Props) {
  const no = tooth.toothNumber;
  const result = pickOf(check.picks, no);
  const failing = result === LABO_TOOTH_RESULT.Failed;
  const count = shownReturnCount(tooth, failing);
  const folded = check.collapsed.has(no);
  const rowClass = ["pd-labo-tooth-row", failing && "pd-labo-tooth-row--fail"].filter(Boolean).join(" ");

  return (
    <li className={rowClass}>
      <div className="pd-labo-tooth-line">
        <span className="pd-labo-tooth-no">{t("Labo:Check:ToothLabel", no)}</span>
        <LaboToothShade shade={tooth.shade} />
        <Form.Item
          name={["teeth", toothKey(no), "result"]}
          rules={[{ required: true, message: t("Labo:Check:ResultRequired") }]}
          className="pd-labo-tooth-field"
        >
          <LaboToothResultToggle tooth={no} disabled={!check.editable} />
        </Form.Item>
        <LaboReturnCount count={count} />
        <LaboToothWarranty tooth={tooth} passed={result === LABO_TOOTH_RESULT.Passed} />
        {failing && (
          <button type="button" className="pd-labo-tooth-fold" onClick={() => check.toggleCollapsed(no)}>
            {folded ? <CaretDownOutlined /> : <CaretUpOutlined />}
            {t(folded ? "Labo:Check:Expand" : "Labo:Check:Collapse")}
          </button>
        )}
      </div>
      {failing && (
        <LaboToothDefectGroup
          tooth={no}
          roundNo={check.roundNo}
          returns={{ no: count, pastNotes: returnNotes(order, no) }}
          tiles={check.tiles}
          state={{ busy: check.busy || !check.editable, hidden: folded, picturesMissing: check.picturesMissing(no) }}
        />
      )}
    </li>
  );
}
