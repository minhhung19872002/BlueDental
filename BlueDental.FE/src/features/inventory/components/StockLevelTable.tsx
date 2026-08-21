// StockLevelTable — shows current stock levels for dental supplies and materials.
// TODO: Add low-stock alerts, reorder triggers, and supplier info.

import { Table } from "antd";

export function StockLevelTable() {
  return (
    <Table
      dataSource={[]}
      columns={[
        { title: "Vật tư / Thuốc", dataIndex: "name", key: "name" },
        { title: "Đơn vị", dataIndex: "unit", key: "unit", width: 80 },
        { title: "Tồn kho", dataIndex: "quantity", key: "quantity", width: 100 },
        { title: "Mức tối thiểu", dataIndex: "minQty", key: "minQty", width: 120 },
      ]}
      locale={{ emptyText: "Chưa có dữ liệu kho" }}
      pagination={false}
    />
  );
}
