import { Empty, Tabs } from "antd";

const TABS = [
  { key: "branches", label: "Chi nhánh" },
  { key: "departments", label: "Phòng ban" },
];

export function OrganizationListPage() {
  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid #E5E7EB",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1B2A41" }}>
          Chi nhánh & Phòng ban
        </h2>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          padding: "0 20px",
        }}
      >
        <Tabs
          items={TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            children: (
              <div style={{ padding: "24px 0" }}>
                <Empty description={`Chưa có dữ liệu ${tab.label.toLowerCase()}`} />
              </div>
            ),
          }))}
        />
      </div>
    </div>
  );
}
