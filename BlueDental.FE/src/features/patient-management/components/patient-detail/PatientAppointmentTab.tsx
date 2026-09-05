import { useState } from "react";
import { Button } from "antd";
import { CalendarOutlined, HistoryOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { AppointmentHistoryModal } from "@/features/appointments/components/history/AppointmentHistoryModal";
import { useDeleteAppointment } from "@/features/appointments/api/appointmentMutations";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import type { Appointment } from "@/features/appointments/types/appointment";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  APPOINTMENT_GROUPS,
  buildAppointmentColumns,
  inAppointmentGroup,
  type AppointmentGroupKey,
} from "./patientAppointmentColumns";

/**
 * Lịch hẹn.
 *
 * One white card holds the four counters, the two commands the reference puts
 * on the right, and the bordered table under them — the board layout of
 * /cskh-grouping. The counters double as filters, as they do on every other
 * BlueDental screen that has them.
 */
export function PatientAppointmentTab({ patientId }: { patientId: string }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState<Appointment | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [group, setGroup] = useState<AppointmentGroupKey | null>(null);

  const pagination = useTablePagination(20);
  const remove = useDeleteAppointment();

  // Every appointment of this patient, for the four counters. They count the
  // whole record, not the page on screen.
  const all = useAppointmentList({ patientId, maxResultCount: 500 });
  const everything = all.data?.items ?? [];

  const page = useAppointmentList({
    patientId,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const rows = (page.data?.items ?? []).filter(
    (row) => !group || inAppointmentGroup(group, row.status),
  );
  const totalCount = group
    ? everything.filter((row) => inAppointmentGroup(group, row.status)).length
    : page.data?.totalCount ?? 0;

  const columns = buildAppointmentColumns({ onEdit: setEditing, onDelete: setDeleting });

  const refresh = () => {
    void page.refetch();
    void all.refetch();
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t("Đã xoá lịch hẹn"));
      setDeleting(null);
      refresh();
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  return (
    <section className="pd-pane pd-pane--fill">
      <div className="reception-card reception-card--content pd-appointment-card">
        <div className="pd-appointment-toolbar">
          <div className="pd-stat-row">
            {APPOINTMENT_GROUPS.map((item) => (
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
                <strong>
                  {everything.filter((row) => inAppointmentGroup(item.key, row.status)).length}
                </strong>
                <span>{t(item.label)}</span>
              </button>
            ))}
          </div>

          <div>
            <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
              {t("Lịch sử thay đổi")}
            </Button>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => setCreating(true)}>
              {t("Tạo lịch hẹn mới")}
            </Button>
          </div>
        </div>

        <div className="bd-cat-card">
          <DataTable<Appointment>
            rowKey="id"
            loading={page.isFetching}
            columns={columns}
            dataSource={rows}
            locale={{ emptyText: t("Không có dữ liệu") }}
            pagination={pagination.buildConfig(totalCount, countedTotal(t("lịch hẹn")))}
          />
        </div>
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
        noun={t("lịch hẹn")}
        title={t("Xoá lịch hẹn")}
        question={t("Bạn có chắc muốn xoá lịch hẹn này không?")}
        pending={remove.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleting(null)}
      />

      <AppointmentHistoryModal
        open={historyOpen}
        patientId={patientId}
        onClose={() => setHistoryOpen(false)}
      />
    </section>
  );
}
