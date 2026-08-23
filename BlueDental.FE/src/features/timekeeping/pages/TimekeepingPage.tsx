import { useState } from "react";
import { DatePicker } from "antd";
import { useTranslation } from "react-i18next";
import dayjs, { type Dayjs } from "dayjs";
import { TimekeepingBoard } from "../components/TimekeepingBoard";

export function TimekeepingPage() {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());

  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1B2A41" }}>
          {t("timekeeping.title")}
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
