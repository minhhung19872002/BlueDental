import { Tag } from "antd";
import { SUPPLY_STATUS_CONFIG, type SupplyStatus } from "../api/suppliesApi";
import { t } from "@/lib/i18n";

interface Props {
  status: SupplyStatus;
}

/**
 * What state a material is in — derived by the server from its stock and its
 * expiry, never stored, so the badge is only ever a reading of the row.
 */
export function MaterialStatusTag({ status }: Props) {
  const config = SUPPLY_STATUS_CONFIG[status];
  if (!config) return <span>—</span>;

  return <Tag color={config.color}>{t(config.label)}</Tag>;
}
