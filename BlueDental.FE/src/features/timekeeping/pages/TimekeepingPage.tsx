import { useState } from "react";
import { DatePickerInput } from "@/components/ui/date-picker-input";
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
          border: "1px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1B2A41" }}>
          {t("Chấm công")}
        </h2>
        <DatePickerInput
          value={currentDate.format("YYYY-MM-DD")}
          onChange={(v) => {
            const d = dayjs(v);
            if (d.isValid()) setCurrentDate(d);
          }}
          className="w-40"
        />
      </div>

      <TimekeepingBoard currentDate={currentDate} />
    </div>
  );
}
