// StockLevelTable — shows current stock levels for dental supplies and materials.
// TODO: Add low-stock alerts, reorder triggers, and supplier info.

import { Table } from "antd";
import { t } from "@/lib/i18n";

export function StockLevelTable() {
  return (
    <Table
      dataSource={[]}
      columns={[
        { title: t("Vật tư / Thuốc"), dataIndex: "name", key: "name" },
        { title: t("Đơn vị"), dataIndex: "unit", key: "unit", width: 80 },
        { title: t("Tồn kho"), dataIndex: "quantity", key: "quantity", width: 100 },
        { title: t("Mức tối thiểu"), dataIndex: "minQty", key: "minQty", width: 120 },
      ]}
      locale={{ emptyText: t("Chưa có dữ liệu kho") }}
      pagination={false}
    />
  );
}
