import { Timeline, Empty, Spin } from "antd";
import { useTranslation } from "react-i18next";
import { usePatientDiagnoses } from "../api/consultingQueries";
import { usePatientConsultationRecords } from "../api/consultationApi";

interface Props {
  patientId: string;
}

interface TimelineEntry {
  date: Date;
  label: string;
  description: string;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

export function TreatmentHistoryTimeline({ patientId }: Props) {
  const { t } = useTranslation();
  const diagnosesQuery = usePatientDiagnoses({ patientId, maxResultCount: 100 });
  const consultationsQuery = usePatientConsultationRecords(patientId);

  const isLoading = diagnosesQuery.isLoading || consultationsQuery.isLoading;

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Spin />
      </div>
    );
  }

  const entries: TimelineEntry[] = [];

  for (const diag of diagnosesQuery.data?.items ?? []) {
    entries.push({
      date: new Date(diag.creationTime),
      label: diag.diagnosisName ?? t("treatment.diagnosis"),
      description: [
        diag.staffName ? `BS: ${diag.staffName}` : null,
        diag.note ?? null,
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }

  for (const rec of consultationsQuery.data ?? []) {
    entries.push({
      date: new Date(rec.creationTime),
      label: rec.serviceName,
      description: rec.notes ?? "",
    });
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (entries.length === 0) {
    return <Empty description={t("treatment.noHistory")} />;
  }

  return (
    <Timeline
      mode="left"
      items={entries.map((entry) => ({
        label: formatDate(entry.date.toISOString()),
        children: (
          <>
            <strong>{entry.label}</strong>
            {entry.description && (
              <div style={{ color: "var(--ant-color-text-secondary, #888)", fontSize: 12 }}>
                {entry.description}
              </div>
            )}
          </>
        ),
      }))}
    />
  );
}
