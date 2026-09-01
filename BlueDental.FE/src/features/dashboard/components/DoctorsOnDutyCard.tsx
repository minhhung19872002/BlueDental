import { Empty, Spin } from "antd";
import dayjs from "dayjs";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { roleLabel } from "@/utils/roleLabel";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

/** Rotating accents so each dentist chip is distinguishable. */
const ACCENTS = [brand.blue, brand.goldDeep, brand.green, brand.purple, brand.teal];

/** Who is booked today, derived from today's appointments rather than a roster. */
export function DoctorsOnDutyCard() {
  const today = dayjs().format("YYYY-MM-DD");
  const { data, isLoading } = useAppointmentList({ date: today, maxResultCount: 200 });

  const { data: dentists } = useDentistList();
  /* Everyone here also carries admin, which says nothing about what they do —
     so take the first role that is not it. */
  const roleById = new Map(
    (dentists ?? []).map((d) => [
      d.id,
      d.roleNames?.find((r) => r.toLowerCase() !== "admin") ?? d.roleNames?.[0],
    ]),
  );

  const byDoctor = new Map<string, { name: string; count: number; role: string }>();
  for (const appt of data?.items ?? []) {
    if (!appt.doctorId || !appt.doctorName) continue;
    const entry = byDoctor.get(appt.doctorId);
    if (entry) entry.count += 1;
    else
      byDoctor.set(appt.doctorId, {
        name: appt.doctorName,
        count: 1,
        role: roleLabel(roleById.get(appt.doctorId), t("Bác sĩ")),
      });
  }
  const doctors = [...byDoctor.values()].sort((a, b) => b.count - a.count);

  return (
    <div className="page-card">
      <div className="dash-card-title" style={{ marginBottom: 12 }}>
        {t("Bác sĩ trực hôm nay")}
      </div>
      {isLoading ? (
        <Spin size="small" />
      ) : doctors.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("Chưa có bác sĩ nào có lịch hôm nay")}
        />
      ) : (
        <div className="dash-list">
          {doctors.map((doc, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <div key={doc.name} className="dash-row">
                <span
                  className="dash-avatar"
                  style={{ background: `${accent}18`, color: accent }}
                >
                  {doc.count}
                </span>
                <span className="dash-row-main">
                  <span className="dash-row-title">{doc.name}</span>
                  <span className="dash-row-sub">{doc.role}</span>
                </span>
                <span className="dash-row-meta">{t("{0} lịch", doc.count)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
