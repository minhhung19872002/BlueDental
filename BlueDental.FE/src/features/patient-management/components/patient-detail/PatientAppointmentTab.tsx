import { useState } from "react";
import { Button } from "antd";
import { CalendarOutlined, HistoryOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { AppointmentHistoryModal } from "@/features/appointments/components/history/AppointmentHistoryModal";
import { useDeleteAppointment } from "@/features/appointments/api/appointmentMutations";
import { useAppointmentList, useAppointmentStats } from "@/features/appointments/api/appointmentQueries";
import type { Appointment } from "@/features/appointments/types/appointment";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  appointmentGroups,
  buildAppointmentColumns,
  type AppointmentGroupKey,
} from "./patientAppointmentColumns";

/**
 * Lịch hẹn.
 *
 * The four counters and the two commands sit on a bare toolbar, with the
 * bordered table card under them — the same layout as the Chăm sóc KH tab,
 * with no outer card around the pair. The counters double as filters, as they
 * do on every other BlueDental screen that has them.
 */
export function PatientAppointmentTab({ patientId }: { patientId: string }) {
  const ability = useAbility("appointment");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState<Appointment | null>(null);
  // One dialog for both entries: the toolbar opens it for the whole patient,
  // a row's clock for that appointment. Closing keeps the appointment so the
  // subtitle does not change while the dialog fades out.
  const [history, setHistory] = useState<{ open: boolean; appointment: Appointment | null }>({
    open: false,
    appointment: null,
  });
  const [group, setGroup] = useState<AppointmentGroupKey | null>(null);

  const pagination = useTablePagination(20);
  const remove = useDeleteAppointment();

  // The four counters count the whole record, not the page on screen, and the
  // server counts them: a patient moved in from an old system can bring
  // hundreds of visits.
  const counts = useAppointmentStats({ patientId });
  const groups = appointmentGroups();
  const countOf = (key: AppointmentGroupKey) =>
    groups
      .find((item) => item.key === key)
      ?.of.reduce((sum, status) => sum + (counts.data?.[status] ?? 0), 0) ?? 0;

  // Latest visit first; a picked counter filters on the server, so paging
  // stays right.
  const page = useAppointmentList({
    patientId,
    statuses: groups.find((item) => item.key === group)?.of,
    newestFirst: true,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const rows = page.data?.items ?? [];
  const totalCount = page.data?.totalCount ?? 0;

  const columns = buildAppointmentColumns({
    onHistory: (appointment) => setHistory({ open: true, appointment }),
    onEdit: ability.canUpdate ? setEditing : undefined,
    onDelete: ability.canDelete ? setDeleting : undefined,
  });

  const refresh = () => {
    void page.refetch();
    void counts.refetch();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t("Patient:Appt:Deleted"));
      setDeleting(null);
      refresh();
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  return (
    <section className="pd-pane pd-pane--fill pd-appointment-tab">
      <div className="pd-appointment-toolbar">
        <div className="pd-stat-row">
          {groups.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-pressed={group === item.key}
              className={`pd-stat pd-stat--${item.tone}${group === item.key ? " active" : ""}`}
              onClick={() =>
                setGroup((current) => {
                  pagination.resetToFirstPage();
                  return current === item.key ? null : item.key;
                })
              }
            >
              <strong>{countOf(item.key)}</strong>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => setHistory({ open: true, appointment: null })}
          >
            {t("Patient:Debt:ChangeHistory")}
          </Button>
          {ability.canCreate && (
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => setCreating(true)}>
              {t("Patient:Appt:Create")}
            </Button>
          )}
        </div>
      </div>

      <div className="bd-cat-card">
        <DataTable<Appointment>
          rowKey="id"
          loading={page.isFetching}
          columns={columns}
          dataSource={rows}
          locale={{ emptyText: t("Common:NoData") }}
          pagination={pagination.buildConfig(totalCount, countedTotal(t("Patient:Misc:Appointment")))}
        />
      </div>

      <AppointmentEditorModal
        open={creating}
        initialPatientId={patientId}
        lockPatient
        onClose={() => setCreating(false)}
        onSuccess={refresh}
      />

      {/* Editing reads the appointment back through the API, so the id is all
          it needs — the dialog fills its own form from what is stored. */}
      <AppointmentEditorModal
        open={Boolean(editing)}
        appointmentId={editing?.id}
        lockPatient
        onClose={() => setEditing(null)}
        onSuccess={refresh}
      />

      {/* The reference's wording: a bare "Xoá lịch hẹn" heading and no record
          name in the question — an appointment has no name to pick out. */}
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        noun={t("Patient:Misc:Appointment")}
        title={t("Patient:Appt:Delete")}
        question={t("Patient:Appt:ConfirmDelete")}
        pending={remove.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleting(null)}
      />

      <AppointmentHistoryModal
        open={history.open}
        patientId={patientId}
        appointment={history.appointment}
        onClose={() => setHistory((current) => ({ ...current, open: false }))}
      />
    </section>
  );
}
