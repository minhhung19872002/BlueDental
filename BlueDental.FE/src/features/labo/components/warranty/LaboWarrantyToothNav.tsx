import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { WarrantyActiveTooth } from "./useWarrantyActiveTooth";

/** ‹ Răng trước · Răng tiếp theo › under the open card form (BA mock BaoHanhV2). */
export function LaboWarrantyToothNav({ active }: { active: WarrantyActiveTooth }) {
  const alone = active.total < 2;
  return (
    <div className="pd-labo-wtooth-nav">
      <Button icon={<LeftOutlined />} disabled={alone} onClick={() => active.step(-1)}>
        {t("Labo:Warranty:PrevTooth")}
      </Button>
      <Button disabled={alone} onClick={() => active.step(1)}>
        {t("Labo:Warranty:NextTooth")}
        <RightOutlined />
      </Button>
    </div>
  );
}

/** ‹ i/n › beside Xem trước thẻ bảo hành: the same walk as the form's. */
export function LaboWarrantyPreviewPager({ active }: { active: WarrantyActiveTooth }) {
  const alone = active.total < 2;
  return (
    <span className="pd-labo-wpreview-pager">
      <Button
        size="small"
        icon={<LeftOutlined />}
        aria-label={t("Labo:Warranty:PrevTooth")}
        disabled={alone}
        onClick={() => active.step(-1)}
      />
      <span>{`${active.index + 1}/${active.total}`}</span>
      <Button
        size="small"
        icon={<RightOutlined />}
        aria-label={t("Labo:Warranty:NextTooth")}
        disabled={alone}
        onClick={() => active.step(1)}
      />
    </span>
  );
}
