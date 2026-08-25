import { useState } from "react";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { TimekeepingBoard } from "../components/TimekeepingBoard";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

export function TimekeepingPage() {
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());

  return (
    <div>
      <PageHeader
        title={t("Chấm công")}
        subtitle={t("Lịch làm việc và ca trực theo tuần")}
      />

      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid var(--bd-line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--bd-ink)" }}>
          {t("Chấm công")}
        </h2>
        <DatePicker
          value={currentDate}
          onChange={(date) => {
            if (date) setCurrentDate(date);
          }}
          format="DD/MM/YYYY"
          allowClear={false}
        />
      </div>

      <TimekeepingBoard currentDate={currentDate} />
    </div>
  );
}
