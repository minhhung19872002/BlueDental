import { Tooltip } from "antd";
import { moneyText } from "../plan/planTypes";
import { discountTooltipLines, totalDiscount, type DiscountParts } from "./planDetailTypes";

/**
 * "Tổng giảm giá": the four parts summed, dotted underline, and staging's
 * four-line breakdown on hover — Giảm dịch vụ · Voucher dịch vụ · Giảm KHDT ·
 * Voucher KHDT, zeros included.
 */
export function DiscountBreakdown({ parts }: { parts: DiscountParts }) {
  const tip = (
    <div className="pdt-discount-tip">
      {discountTooltipLines(parts).map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
  // Opens to the left of the figure, as staging's column builder places it.
  return (
    <Tooltip title={tip} placement="left" classNames={{ root: "pdt-discount-tooltip" }}>
      <span className="pdt-discount">{moneyText(totalDiscount(parts))}</span>
    </Tooltip>
  );
}
