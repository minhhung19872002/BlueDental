import type { ReactNode } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  title: string;
  /** Tailwind max-width for the panel, e.g. "sm:max-w-lg". */
  width?: string;
  /** Disables the save button — a form that cannot be submitted yet. */
  canSave: boolean;
  saving?: boolean;
  onSave: () => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The dialog shell every "Danh mục" screen uses, matching the reference:
 * a bold title with a rule under it, the form, and a rule above a single
 * right-aligned "Lưu".
 *
 * There is deliberately **no "Huỷ" button** — the reference offers only the X,
 * and a cancel button next to save is the kind of small difference that reads
 * as a different application.
 */
export function AppDialog({
  open,
  title,
  width = "sm:max-w-lg",
  canSave,
  saving,
  onSave,
  onClose,
  children,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn("gap-0 p-0", width)}>
        <DialogHeader className="border-b border-app-line px-6 py-4">
          <DialogTitle className="text-[20px] font-bold text-app-ink">{title}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>

        <div className="flex justify-end border-t border-app-line px-6 py-4">
          {/* A disabled button says "not now"; a spinner says "working". The
              save can take a moment, so it has to say which. */}
          <Button onClick={onSave} disabled={!canSave || saving} className="gap-2">
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {saving ? t("Đang lưu…") : t("Lưu")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
