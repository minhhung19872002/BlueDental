import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t, tRich } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** Lowercase noun of what is being deleted, e.g. "nhóm", "thẻ hồ sơ". */
  noun: string;
  /** Name of the record, shown in bold inside the question. */
  name: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The confirmation the reference asks before a delete: the record's own name
 * picked out in bold inside the question, a line saying the action cannot be
 * undone, and a **red** confirm button.
 *
 * The colour is the point — a delete is the one action on these screens that
 * cannot be taken back, so it does not get the same button as "Lưu".
 */
export function ConfirmDeleteDialog({
  open,
  noun,
  name,
  pending,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-[20px] font-bold text-app-ink">
            {t("Xác nhận xoá {0}", noun)}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-5">
          <p className="text-[14px] text-app-ink">
            {tRich(
              "Bạn có chắc muốn xoá {0} {1} không?",
              noun,
              <span className="font-bold">{name}</span>,
            )}
          </p>
          <p className="mt-1 text-[13px] text-app-label">{t("Hành động này không thể hoàn tác.")}</p>
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <Button
            variant="ghost"
            onClick={onClose}
            className="bg-app-primary-soft text-app-primary hover:bg-app-primary-soft/70"
          >
            {t("Huỷ")}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="gap-2 bg-app-danger text-white hover:bg-app-danger/90"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-4" aria-hidden="true" />
            )}
            {pending ? t("Đang xoá…") : t("Xoá")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
