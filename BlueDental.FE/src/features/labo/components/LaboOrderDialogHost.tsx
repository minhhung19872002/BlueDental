import { useSearchParams } from "react-router-dom";
import type { LaboOrderDto } from "../api/laboApi";
import { LaboChildDialog } from "./order-dialogs/LaboChildDialog";
import { LaboDetailDialog } from "./order-dialogs/LaboDetailDialog";
import { LABO_MODAL_PARAM, LABO_ROW_PARAM, type LaboChildKind } from "./order-dialogs/laboModalKeys";

interface Props {
  branchId: string;
  /** The page on screen — the child dialog's parent row is looked up in it. */
  rows: LaboOrderDto[];
  /** The row behind the eye; null keeps the detail closed. */
  detail: LaboOrderDto | null;
  /** `laboTemplate:update` — the detail's status select, Tải ảnh well and Lưu. */
  canUpdate: boolean;
  /** `appointment:create` — the detail's "Tạo Lịch Hẹn Mới". */
  canCreateAppointment: boolean;
  onCloseDetail: () => void;
}

/** The two dialogs a Mẫu Labo row raises through the URL: the plus and the shield. */
const CHILD_KINDS: readonly LaboChildKind[] = ["continue-process", "warranty"];

/**
 * The dialogs a Mẫu Labo row can raise. On the patient's tab the patient is
 * the page's; here every row names its own, so the child dialog is mounted
 * only once `laboRowId` resolves to a row on screen and its patient is known.
 */
export function LaboOrderDialogHost({
  branchId,
  rows,
  detail,
  canUpdate,
  canCreateAppointment,
  onCloseDetail,
}: Props) {
  const [searchParams] = useSearchParams();
  const modal = searchParams.get(LABO_MODAL_PARAM);
  const kind = CHILD_KINDS.find((key) => key === modal) ?? null;
  const parentId = searchParams.get(LABO_ROW_PARAM);
  const parent = parentId ? rows.find((row) => row.id === parentId) : undefined;

  return (
    <>
      {parent && <LaboChildDialog kind={kind} branchId={branchId} parent={parent} />}
      <LaboDetailDialog
        order={detail}
        branchId={branchId}
        patient={{
          code: detail?.patientCode ?? "",
          name: detail?.patientName ?? "",
          dateOfBirth: detail?.patientDateOfBirth ?? null,
        }}
        mode={{ variant: "orders", canUpdate, canCreateAppointment }}
        onClose={onCloseDetail}
      />
    </>
  );
}
