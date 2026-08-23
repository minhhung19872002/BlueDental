import { Tabs } from "antd";

const TABS = [
  { key: "general", label: "Cấu hình chung" },
  { key: "print", label: "Cấu hình in" },
  { key: "clinic", label: "Cấu hình phòng khám" },
];

export function SettingsPage() {
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
          Cài đặt hệ thống
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
              <div
                style={{
                  padding: "24px 0",
                  color: "#9CA3AF",
                  textAlign: "center",
                  fontSize: 14,
                }}
              >
                {tab.label} — Đang phát triển...
              </div>
            ),
          }))}
        />
      </div>
    </div>
  );
}
