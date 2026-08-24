import { toast } from "sonner";
import {
  useOpenWorkDay,
  useRegisterDayOff,
  useRegisterWorking,
} from "@/features/timekeeping/api/timekeepingQueries";
import type { TimeKeepingRecordDto } from "@/features/timekeeping/api/timekeepingApi";
import type { StaffDto } from "../api/staffApi";
import type { RosterDay } from "../api/rosterQueries";
import { extractApiError } from "@/lib/apiError";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/** Rotating accents, so cards next to each other stay distinguishable. */
const ACCENTS = [brand.blue, brand.goldDeep, brand.green, brand.purple, brand.teal, brand.pink];

export function accentFor(index: number): string {
  return ACCENTS[index % ACCENTS.length];
}

function initialsOf(name: string | null | undefined, fallback: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface StaffRosterCardProps {
  staff: StaffDto;
  accent: string;
  days: RosterDay[];
  clinicBranchId: string;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * The design's staff card: identity on top, the week's shifts underneath.
 *
 * A day has no attendance record until the work day is opened for that person,
 * so switching a day on may have to create the record first.
 */
export function StaffRosterCard({
  staff,
  accent,
  days,
  clinicBranchId,
  onEdit,
  onDelete,
}: StaffRosterCardProps) {
  const openWorkDay = useOpenWorkDay();
  const registerWorking = useRegisterWorking();
  const registerDayOff = useRegisterDayOff();
  const busy =
    openWorkDay.isPending || registerWorking.isPending || registerDayOff.isPending;

  const toggle = async (day: RosterDay) => {
    try {
      if (day.working && day.record) {
        await registerDayOff.mutateAsync({ id: day.record.id });
        return;
      }
      const record: TimeKeepingRecordDto =
        day.record ??
        ((await openWorkDay.mutateAsync({
          staffId: staff.id,
          clinicBranchId,
          workDate: day.date,
        })) as TimeKeepingRecordDto);
      await registerWorking.mutateAsync(record.id);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <div className="staff-card">
      <div className="staff-card-head">
        <span className="staff-card-avatar" style={{ background: `${accent}18`, color: accent }}>
          {initialsOf(staff.fullName, staff.userName)}
        </span>
        <span className="staff-card-identity">
          <span className="staff-card-name">{staff.fullName || staff.userName}</span>
          <span className="staff-card-meta">
            {staff.roleNames.length > 0 ? staff.roleNames.join(", ") : t("Chưa gán vai trò")}
          </span>
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
          style={staff.isActive ? { background: "#dcfce7", color: "#15803d" } : { background: "#f3f4f6", color: "#374151" }}
        >
          {staff.isActive ? t("Đang làm việc") : t("Đã nghỉ")}
        </span>
      </div>

      <div className="staff-card-days">
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            disabled={busy}
            title={day.date}
            aria-pressed={day.working}
            className="staff-day"
            style={
              day.working
                ? { background: accent, color: "#fff" }
                : { background: brand.lineSoft, color: brand.dim }
            }
            onClick={() => void toggle(day)}
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="staff-card-actions">
        <Button size="sm" variant="outline" onClick={onEdit}>
          {t("Chỉnh sửa")}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              {t("Xoá")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("Xoá nhân viên này?")}</AlertDialogTitle>
              <AlertDialogDescription>
                {staff.fullName || staff.userName}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>{t("Xoá")}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
