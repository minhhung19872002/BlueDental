// ToolsPage — /tools
// Communication tools page: SMS sending, templates, history, and configuration.
// Tabs are stubs — real functionality wired when SMS integration API is ready.

import { useState } from "react";
import { Tabs, Empty } from "antd";

interface ToolsTab {
  key: string;
  label: string;
}

const TOOLS_TABS: ToolsTab[] = [
  { key: "sms-send", label: "Gửi SMS" },
  { key: "sms-template", label: "Mẫu SMS" },
  { key: "sms-history", label: "Lịch sử gửi" },
  { key: "config", label: "Cấu hình" },
];

export function ToolsPage() {
  const [activeTab, setActiveTab] = useState("sms-send");

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={TOOLS_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />
      </div>
      <div className="reception-card reception-card--content">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có dữ liệu"
          style={{ padding: "40px 0" }}
        />
      </div>
    </div>
  );
}
